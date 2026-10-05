import { Router } from 'express';
import { get, all, run, now } from '../db.js';
import { requireAdmin } from '../auth.js';
import { queueDepth } from '../judge/judge.js';
import { verdictLabel } from '../util.js';

const router = Router();
router.use(requireAdmin);

router.get('/stats', (req, res) => {
  const totals = {
    users: get('SELECT COUNT(*) AS c FROM users').c,
    problems: get('SELECT COUNT(*) AS c FROM problems').c,
    submissions: get('SELECT COUNT(*) AS c FROM submissions').c,
    pending: get(`SELECT COUNT(*) AS c FROM submissions WHERE status IN ('queued','running')`).c,
    contests: get('SELECT COUNT(*) AS c FROM contests').c,
    tests: get('SELECT COUNT(*) AS c FROM test_cases').c,
    accepted: get(`SELECT COUNT(*) AS c FROM submissions WHERE verdict='AC'`).c,
  };
  const verdictRows = all(`SELECT verdict, COUNT(*) AS c FROM submissions WHERE verdict IS NOT NULL GROUP BY verdict ORDER BY c DESC`);
  const verdicts = verdictRows.map((v) => ({ verdict: v.verdict, label: verdictLabel(v.verdict), count: v.c }));

  const day = 86400000;
  const recentDays = [];
  for (let i = 13; i >= 0; i--) {
    const start = now() - (i + 1) * day;
    const end = now() - i * day;
    const c = get('SELECT COUNT(*) AS c FROM submissions WHERE created_at > ? AND created_at <= ?', start, end).c;
    recentDays.push({ date: new Date(end).toISOString().slice(0, 10), count: c });
  }

  const topProblems = all(
    `SELECT p.id, p.title, COUNT(s.id) AS submissions,
       SUM(CASE WHEN s.verdict='AC' THEN 1 ELSE 0 END) AS accepted
     FROM problems p LEFT JOIN submissions s ON s.problem_id = p.id AND s.mode='submit'
     GROUP BY p.id ORDER BY submissions DESC LIMIT 8`
  );
  const topUsers = all(
    `SELECT u.username, COUNT(s.id) AS submissions,
       SUM(CASE WHEN s.verdict='AC' THEN 1 ELSE 0 END) AS accepted
     FROM users u JOIN submissions s ON s.user_id = u.id AND s.mode='submit'
     GROUP BY u.id ORDER BY submissions DESC LIMIT 8`
  );
  const recent = all(
    `SELECT s.id, u.username, p.title AS problem_title, s.language, s.status, s.verdict, s.created_at
     FROM submissions s JOIN users u ON u.id=s.user_id JOIN problems p ON p.id=s.problem_id
     ORDER BY s.id DESC LIMIT 25`
  );
  res.json({ totals, verdicts, recentDays, topProblems, topUsers, recent, queue: queueDepth() });
});

router.get('/users', (req, res) => {
  const rows = all(`
    SELECT u.id, u.username, u.role, u.banned, u.created_at,
      (SELECT COUNT(*) FROM submissions WHERE user_id=u.id) AS submissions,
      (SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id=u.id AND verdict='AC') AS solved
    FROM users u ORDER BY u.created_at DESC`);
  res.json({ users: rows });
});

router.put('/users/:id', (req, res) => {
  const u = get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'User not found' });
  const b = req.body || {};
  if (u.id === req.user.id && (b.role === 'user' || b.banned === true)) {
    return res.status(400).json({ error: 'You cannot demote or ban yourself' });
  }
  const role = b.role === 'admin' || b.role === 'user' ? b.role : u.role;
  const banned = b.banned === true ? 1 : b.banned === false ? 0 : u.banned;
  run('UPDATE users SET role=?, banned=? WHERE id=?', role, banned, u.id);
  if (banned) run('DELETE FROM sessions WHERE user_id = ?', u.id);
  res.json({ user: get('SELECT id, username, role, banned, created_at FROM users WHERE id = ?', u.id) });
});

router.get('/submissions', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const rows = all(`
    SELECT s.id, u.username, p.title AS problem_title, s.language, s.status, s.verdict, s.time_ms, s.memory_kb,
           s.tests_passed, s.tests_total, s.created_at, s.judged_at, s.mode
    FROM submissions s JOIN users u ON u.id=s.user_id JOIN problems p ON p.id=s.problem_id
    ORDER BY s.id DESC LIMIT ?`, limit);
  res.json({ submissions: rows.map((s) => ({ ...s, verdict_label: verdictLabel(s.verdict) })) });
});

router.delete('/submissions/:id', (req, res) => {
  const s = get('SELECT id FROM submissions WHERE id = ?', Number(req.params.id));
  if (!s) return res.status(404).json({ error: 'Submission not found' });
  run('DELETE FROM submissions WHERE id = ?', s.id);
  res.json({ ok: true });
});

router.delete('/sessions/:token', (req, res) => {
  run('DELETE FROM sessions WHERE token = ?', req.params.token);
  res.json({ ok: true });
});

export default router;
