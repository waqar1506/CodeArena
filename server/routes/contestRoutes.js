import { Router } from 'express';
import { get, all, run, now, tx } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { verdictLabel } from '../util.js';

const router = Router();
const PENALTY_MINUTES = 20;

function statusOf(c, ts = now()) {
  if (ts < c.starts_at) return 'upcoming';
  if (ts > c.ends_at) return 'ended';
  return 'running';
}

function contestView(c, userId) {
  const problems = all(
    `SELECT p.id, p.title, p.slug, p.difficulty, p.time_limit_ms, p.memory_limit_mb, cp.position, cp.score
     FROM contest_problems cp JOIN problems p ON p.id = cp.problem_id
     WHERE cp.contest_id = ? ORDER BY cp.position`,
    c.id
  );
  const registered = userId
    ? !!get('SELECT 1 AS x FROM contest_registrations WHERE contest_id = ? AND user_id = ?', c.id, userId)
    : false;
  const participants = get('SELECT COUNT(*) AS c FROM contest_registrations WHERE contest_id = ?', c.id).c;
  return { ...c, status: statusOf(c), problems, registered, participant_count: participants };
}

router.get('/', (req, res) => {
  const rows = all('SELECT * FROM contests ORDER BY starts_at DESC');
  const isAdmin = req.user?.role === 'admin';
  const list = rows.filter((c) => isAdmin || c.visibility === 'public');
  res.json({ contests: list.map((c) => contestView(c, req.user?.id)) });
});

router.post('/', requireAdmin, (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const startsAt = Number(b.starts_at);
  const endsAt = Number(b.ends_at);
  if (!startsAt || !endsAt || endsAt <= startsAt) return res.status(400).json({ error: 'Valid start and end times are required' });
  const r = run(
    `INSERT INTO contests (title, description, starts_at, ends_at, visibility, created_by, created_at) VALUES (?,?,?,?,?,?,?)`,
    title, String(b.description || ''), startsAt, endsAt,
    b.visibility === 'private' ? 'private' : 'public', req.user.id, now()
  );
  res.status(201).json({ contest: contestView(get('SELECT * FROM contests WHERE id = ?', Number(r.lastInsertRowid)), req.user.id) });
});

router.get('/:id', (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  const isAdmin = req.user?.role === 'admin';
  if (c.visibility !== 'public' && !isAdmin) return res.status(404).json({ error: 'Contest not found' });
  const view = contestView(c, req.user?.id);
  const started = now() >= c.starts_at;
  if (!started && !isAdmin) view.problems = view.problems.map((p) => ({ ...p, id: undefined, title: 'Hidden until start', slug: null, difficulty: 'medium' }));
  view.can_submit = started && now() <= c.ends_at;
  res.json({ contest: view });
});

router.put('/:id', requireAdmin, (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  const b = req.body || {};
  run(
    `UPDATE contests SET title=?, description=?, starts_at=?, ends_at=?, visibility=? WHERE id=?`,
    b.title != null ? String(b.title) : c.title,
    b.description != null ? String(b.description) : c.description,
    b.starts_at != null ? Number(b.starts_at) : c.starts_at,
    b.ends_at != null ? Number(b.ends_at) : c.ends_at,
    b.visibility === 'private' || b.visibility === 'public' ? b.visibility : c.visibility,
    c.id
  );
  res.json({ contest: contestView(get('SELECT * FROM contests WHERE id = ?', c.id), req.user.id) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  run('DELETE FROM contests WHERE id = ?', c.id);
  res.json({ ok: true });
});

router.post('/:id/register', requireAuth, (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  if (now() > c.ends_at) return res.status(400).json({ error: 'Contest already ended' });
  run('INSERT OR IGNORE INTO contest_registrations (contest_id, user_id, registered_at) VALUES (?,?,?)', c.id, req.user.id, now());
  res.json({ ok: true });
});

router.delete('/:id/register', requireAuth, (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  if (now() >= c.starts_at) return res.status(400).json({ error: 'Cannot leave after the contest has started' });
  run('DELETE FROM contest_registrations WHERE contest_id = ? AND user_id = ?', c.id, req.user.id);
  res.json({ ok: true });
});

router.post('/:id/problems', requireAdmin, (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  const p = get('SELECT * FROM problems WHERE id = ?', Number(req.body?.problem_id));
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  const count = get('SELECT COUNT(*) AS c FROM contest_problems WHERE contest_id = ?', c.id).c;
  run('INSERT OR REPLACE INTO contest_problems (contest_id, problem_id, position, score) VALUES (?,?,?,?)',
    c.id, p.id, Number(req.body?.position) || count + 1, Number(req.body?.score) || 100);
  res.status(201).json({ ok: true });
});

router.delete('/:id/problems/:problemId', requireAdmin, (req, res) => {
  run('DELETE FROM contest_problems WHERE contest_id = ? AND problem_id = ?', Number(req.params.id), Number(req.params.problemId));
  res.json({ ok: true });
});

router.get('/:id/standings', (req, res) => {
  const c = get('SELECT * FROM contests WHERE id = ?', Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Contest not found' });
  const isAdmin = req.user?.role === 'admin';
  if (c.visibility !== 'public' && !isAdmin) return res.status(404).json({ error: 'Contest not found' });
  if (now() < c.starts_at && !isAdmin) return res.json({ standings: [], locked: true });

  const problems = all(
    'SELECT cp.problem_id, cp.position, cp.score FROM contest_problems cp WHERE cp.contest_id = ? ORDER BY cp.position',
    c.id
  );
  const participants = all(
    `SELECT u.id, u.username FROM contest_registrations cr JOIN users u ON u.id = cr.user_id
     WHERE cr.contest_id = ? AND u.banned = 0`,
    c.id
  );
  const subs = all(
    `SELECT s.user_id, s.problem_id, s.verdict, s.created_at, s.judged_at, s.contest_id
     FROM submissions s WHERE s.contest_id = ? AND s.mode = 'submit' ORDER BY s.id`,
    c.id
  );

  const byUser = new Map();
  for (const s of subs) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id).push(s);
  }

  const standings = participants.map((u) => {
    let solved = 0;
    let penalty = 0;
    const cells = problems.map((prob) => {
      const list = (byUser.get(u.id) || []).filter((s) => s.problem_id === prob.problem_id);
      let firstAc = null;
      let wrong = 0;
      for (const s of list) {
        if (s.verdict === 'AC') { firstAc = s; break; }
        wrong++;
      }
      if (firstAc) {
        solved++;
        const mins = Math.floor((firstAc.judged_at - c.starts_at) / 60000);
        const pen = Math.max(0, mins) + wrong * PENALTY_MINUTES;
        penalty += pen;
        return { problem_id: prob.problem_id, solved: true, attempts: wrong + 1, penalty: pen, time: Math.max(0, mins) };
      }
      return { problem_id: prob.problem_id, solved: false, attempts: list.length, penalty: 0, time: null };
    });
    return { user_id: u.id, username: u.username, solved, penalty, cells };
  });

  standings.sort((a, b) => b.solved - a.solved || a.penalty - b.penalty || a.username.localeCompare(b.username));
  res.json({
    standings: standings.map((s, i) => ({ rank: i + 1, ...s })),
    problems: problems.map((p, i) => ({ ...p, index: i })),
    verdict_labels: { AC: verdictLabel('AC') },
  });
});

export default router;
