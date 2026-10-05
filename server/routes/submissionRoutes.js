import { Router } from 'express';
import { get, all, run, now } from '../db.js';
import { requireAuth } from '../auth.js';
import { enqueue } from '../judge/judge.js';
import { LANGUAGES } from '../judge/languages.js';
import { verdictLabel } from '../util.js';

const router = Router();
const MAX_SOURCE = 200 * 1024;

router.get('/languages', (req, res) => {
  res.json({ languages: Object.values(LANGUAGES) });
});

router.post('/', requireAuth, (req, res) => {
  const b = req.body || {};
  const problemId = Number(b.problem_id);
  const language = String(b.language || '');
  const source = String(b.source || '');
  const mode = b.mode === 'sample' ? 'sample' : 'submit';

  if (!LANGUAGES[language]) return res.status(400).json({ error: 'Unsupported language' });
  if (!source.trim()) return res.status(400).json({ error: 'Source code is empty' });
  if (source.length > MAX_SOURCE) return res.status(400).json({ error: 'Source code exceeds 200 KB limit' });

  const problem = get('SELECT * FROM problems WHERE id = ?', problemId);
  if (!problem || (problem.visibility !== 'public' && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  let contestId = null;
  if (b.contest_id) {
    const contest = get('SELECT * FROM contests WHERE id = ?', Number(b.contest_id));
    if (!contest) return res.status(404).json({ error: 'Contest not found' });
    const ts = now();
    if (ts < contest.starts_at) return res.status(400).json({ error: 'Contest has not started yet' });
    if (ts > contest.ends_at) return res.status(400).json({ error: 'Contest has ended' });
    const inContest = get('SELECT 1 AS x FROM contest_problems WHERE contest_id = ? AND problem_id = ?', contest.id, problemId);
    if (!inContest) return res.status(400).json({ error: 'Problem is not part of that contest' });
    if (!get('SELECT 1 AS x FROM contest_registrations WHERE contest_id = ? AND user_id = ?', contest.id, req.user.id)) {
      return res.status(400).json({ error: 'Register for the contest first' });
    }
    contestId = contest.id;
  }

  const pending = get(
    `SELECT id FROM submissions WHERE user_id = ? AND status IN ('queued','running') AND mode='submit'`,
    req.user.id
  );
  if (pending && mode === 'submit') {
    return res.status(429).json({ error: 'You already have a submission being judged. Please wait.' });
  }

  const r = run(
    `INSERT INTO submissions (user_id, problem_id, contest_id, mode, language, source, status, created_at)
     VALUES (?,?,?,?,?,?,'queued',?)`,
    req.user.id, problemId, contestId, mode, language, source, now()
  );
  const id = Number(r.lastInsertRowid);
  enqueue(id);
  res.status(201).json({ id });
});

router.get('/', (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const params = [];
  const where = [];
  if (req.query.mine === '1') {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    where.push('s.user_id = ?');
    params.push(req.user.id);
  } else if (req.query.user) {
    where.push('u.username = ?');
    params.push(String(req.query.user));
  }
  if (req.query.problem_id) {
    where.push('s.problem_id = ?');
    params.push(Number(req.query.problem_id));
  }
  if (req.query.contest_id) {
    where.push('s.contest_id = ?');
    params.push(Number(req.query.contest_id));
  }
  if (req.query.verdict) {
    where.push('s.verdict = ?');
    params.push(String(req.query.verdict));
  }
  where.push(`s.mode = 'submit'`);
  const sql = `
    SELECT s.id, s.user_id, u.username, s.problem_id, p.title AS problem_title, p.slug AS problem_slug,
           s.contest_id, s.language, s.status, s.verdict, s.time_ms, s.memory_kb, s.score,
           s.tests_passed, s.tests_total, s.created_at, s.judged_at
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN problems p ON p.id = s.problem_id
    WHERE ${where.join(' AND ')}
    ORDER BY s.id DESC LIMIT ? OFFSET ?`;
  const rows = all(sql, ...params, limit, offset);
  res.json({
    submissions: rows.map((s) => ({ ...s, verdict_label: verdictLabel(s.verdict) })),
    has_more: rows.length === limit,
  });
});

function canViewSubmission(sub, user) {
  if (!user) return false;
  return user.role === 'admin' || user.id === sub.user_id;
}

router.get('/:id', (req, res) => {
  const sub = get(
    `SELECT s.*, u.username, p.title AS problem_title, p.slug AS problem_slug, p.time_limit_ms, p.memory_limit_mb
     FROM submissions s JOIN users u ON u.id = s.user_id JOIN problems p ON p.id = s.problem_id
     WHERE s.id = ?`,
    Number(req.params.id)
  );
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  const privileged = canViewSubmission(sub, req.user);
  const tests = privileged
    ? all('SELECT position, verdict, time_ms, memory_kb, message FROM submission_tests WHERE submission_id = ? ORDER BY position', sub.id)
    : [];
  res.json({
    submission: {
      id: sub.id,
      user_id: sub.user_id,
      username: sub.username,
      problem_id: sub.problem_id,
      problem_title: sub.problem_title,
      problem_slug: sub.problem_slug,
      contest_id: sub.contest_id,
      language: sub.language,
      status: sub.status,
      verdict: sub.verdict,
      verdict_label: verdictLabel(sub.verdict),
      message: privileged ? sub.message : sub.verdict === 'CE' ? 'Compilation Error' : null,
      time_ms: sub.time_ms,
      memory_kb: sub.memory_kb,
      score: sub.score,
      tests_passed: sub.tests_passed,
      tests_total: sub.tests_total,
      created_at: sub.created_at,
      judged_at: sub.judged_at,
      time_limit_ms: sub.time_limit_ms,
      memory_limit_mb: sub.memory_limit_mb,
      source: privileged ? sub.source : null,
      tests,
    },
  });
});

export default router;
