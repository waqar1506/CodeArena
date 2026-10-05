import { Router } from 'express';
import { get, all, run, now } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { slugify, escapeHtml } from '../util.js';

const router = Router();

const WEIGHT = { easy: 100, medium: 200, hard: 300 };

function withStats(p, userId) {
  const solvedCount = get(
    `SELECT COUNT(DISTINCT user_id) AS c FROM submissions WHERE problem_id = ? AND verdict='AC' AND mode='submit'`,
    p.id
  ).c;
  const attempts = get(
    `SELECT COUNT(*) AS c FROM submissions WHERE problem_id = ? AND mode='submit'`,
    p.id
  ).c;
  let solvedByMe = false;
  let attemptedByMe = false;
  if (userId) {
    solvedByMe = !!get(
      `SELECT id FROM submissions WHERE problem_id = ? AND user_id = ? AND verdict='AC' AND mode='submit'`,
      p.id, userId
    );
    attemptedByMe = !!get(
      `SELECT id FROM submissions WHERE problem_id = ? AND user_id = ? AND mode='submit'`,
      p.id, userId
    );
  }
  const testCount = get('SELECT COUNT(*) AS c FROM test_cases WHERE problem_id = ?', p.id).c;
  return { ...p, solved_count: solvedCount, attempt_count: attempts, solved_by_me: solvedByMe, attempted_by_me: attemptedByMe, test_count: testCount };
}

router.get('/', (req, res) => {
  const { search = '', difficulty = '', tag = '' } = req.query;
  const userId = req.user?.id || null;
  const isAdmin = req.user?.role === 'admin';
  let rows = isAdmin
    ? all(`SELECT * FROM problems ORDER BY id`)
    : all(`SELECT * FROM problems WHERE visibility = 'public' ORDER BY id`);
  if (difficulty) rows = rows.filter((p) => p.difficulty === difficulty);
  if (tag) rows = rows.filter((p) => p.tags.split(',').map((t) => t.trim()).includes(tag));
  if (search) {
    const q = String(search).toLowerCase();
    rows = rows.filter((p) => p.title.toLowerCase().includes(q) || p.slug.includes(q) || p.tags.toLowerCase().includes(q));
  }
  res.json({ problems: rows.map((p) => withStats(p, userId)) });
});

router.get('/tags', (req, res) => {
  const tags = new Set();
  for (const p of all(`SELECT tags FROM problems WHERE visibility='public'`)) {
    for (const t of p.tags.split(',')) {
      const v = t.trim();
      if (v) tags.add(v);
    }
  }
  res.json({ tags: [...tags].sort() });
});

router.get('/:id', (req, res) => {
  const key = req.params.id;
  const p = /^\d+$/.test(key)
    ? get('SELECT * FROM problems WHERE id = ?', Number(key))
    : get('SELECT * FROM problems WHERE slug = ?', key);
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  const isAdmin = req.user?.role === 'admin';
  if (p.visibility !== 'public' && !isAdmin) return res.status(404).json({ error: 'Problem not found' });

  const testRows = isAdmin
    ? all('SELECT * FROM test_cases WHERE problem_id = ? ORDER BY position', p.id)
    : all('SELECT id, position, input, expected_output, is_sample FROM test_cases WHERE problem_id = ? AND is_sample = 1 ORDER BY position', p.id);
  res.json({ problem: withStats(p, req.user?.id || null), tests: testRows });
});

router.post('/', requireAdmin, (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Title is required' });
  const slug = String(b.slug || '').trim() ? slugify(b.slug) : slugify(title);
  if (!slug) return res.status(400).json({ error: 'Invalid slug' });
  if (get('SELECT id FROM problems WHERE slug = ?', slug)) return res.status(409).json({ error: 'Slug already exists' });
  const difficulty = ['easy', 'medium', 'hard'].includes(b.difficulty) ? b.difficulty : 'medium';
  const ts = now();
  const r = run(
    `INSERT INTO problems (slug, title, difficulty, tags, statement, input_spec, output_spec, constraints, time_limit_ms, memory_limit_mb, visibility, author_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    slug, title, difficulty,
    String(b.tags || ''), String(b.statement || ''), String(b.input_spec || ''), String(b.output_spec || ''), String(b.constraints || ''),
    Math.max(100, Math.min(10000, Number(b.time_limit_ms) || 1000)),
    Math.max(16, Math.min(1024, Number(b.memory_limit_mb) || 256)),
    b.visibility === 'private' ? 'private' : 'public',
    req.user.id, ts, ts
  );
  const p = get('SELECT * FROM problems WHERE id = ?', Number(r.lastInsertRowid));
  res.status(201).json({ problem: p });
});

router.put('/:id', requireAdmin, (req, res) => {
  const p = get('SELECT * FROM problems WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  const b = req.body || {};
  const slug = b.slug != null ? slugify(b.slug) : p.slug;
  if (slug !== p.slug && get('SELECT id FROM problems WHERE slug = ? AND id != ?', slug, p.id)) {
    return res.status(409).json({ error: 'Slug already exists' });
  }
  run(
    `UPDATE problems SET slug=?, title=?, difficulty=?, tags=?, statement=?, input_spec=?, output_spec=?, constraints=?,
      time_limit_ms=?, memory_limit_mb=?, visibility=?, updated_at=? WHERE id=?`,
    slug,
    b.title != null ? String(b.title) : p.title,
    ['easy', 'medium', 'hard'].includes(b.difficulty) ? b.difficulty : p.difficulty,
    b.tags != null ? String(b.tags) : p.tags,
    b.statement != null ? String(b.statement) : p.statement,
    b.input_spec != null ? String(b.input_spec) : p.input_spec,
    b.output_spec != null ? String(b.output_spec) : p.output_spec,
    b.constraints != null ? String(b.constraints) : p.constraints,
    b.time_limit_ms != null ? Math.max(100, Math.min(10000, Number(b.time_limit_ms) || p.time_limit_ms)) : p.time_limit_ms,
    b.memory_limit_mb != null ? Math.max(16, Math.min(1024, Number(b.memory_limit_mb) || p.memory_limit_mb)) : p.memory_limit_mb,
    b.visibility === 'private' || b.visibility === 'public' ? b.visibility : p.visibility,
    now(),
    p.id
  );
  res.json({ problem: get('SELECT * FROM problems WHERE id = ?', p.id) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const p = get('SELECT * FROM problems WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  run('DELETE FROM problems WHERE id = ?', p.id);
  res.json({ ok: true });
});

router.get('/:id/tests', requireAdmin, (req, res) => {
  const p = get('SELECT * FROM problems WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  res.json({ tests: all('SELECT * FROM test_cases WHERE problem_id = ? ORDER BY position', p.id) });
});

router.post('/:id/tests', requireAdmin, (req, res) => {
  const p = get('SELECT * FROM problems WHERE id = ?', Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Problem not found' });
  const b = req.body || {};
  if (typeof b.input !== 'string' || typeof b.expected_output !== 'string') {
    return res.status(400).json({ error: 'input and expected_output are required' });
  }
  const count = get('SELECT COUNT(*) AS c FROM test_cases WHERE problem_id = ?', p.id).c;
  const r = run(
    'INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES (?,?,?,?,?)',
    p.id, count + 1, b.input, b.expected_output, b.is_sample ? 1 : 0
  );
  res.status(201).json({ test: get('SELECT * FROM test_cases WHERE id = ?', Number(r.lastInsertRowid)) });
});

router.put('/:id/tests/:testId', requireAdmin, (req, res) => {
  const t = get('SELECT * FROM test_cases WHERE id = ? AND problem_id = ?', Number(req.params.testId), Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Test case not found' });
  const b = req.body || {};
  run(
    'UPDATE test_cases SET input=?, expected_output=?, is_sample=?, position=? WHERE id=?',
    b.input != null ? String(b.input) : t.input,
    b.expected_output != null ? String(b.expected_output) : t.expected_output,
    b.is_sample != null ? (b.is_sample ? 1 : 0) : t.is_sample,
    b.position != null ? Number(b.position) || t.position : t.position,
    t.id
  );
  res.json({ test: get('SELECT * FROM test_cases WHERE id = ?', t.id) });
});

router.delete('/:id/tests/:testId', requireAdmin, (req, res) => {
  const t = get('SELECT * FROM test_cases WHERE id = ? AND problem_id = ?', Number(req.params.testId), Number(req.params.id));
  if (!t) return res.status(404).json({ error: 'Test case not found' });
  run('DELETE FROM test_cases WHERE id = ?', t.id);
  run('UPDATE test_cases SET position = position - 1 WHERE problem_id = ? AND position > ?', t.problem_id, t.position);
  res.json({ ok: true });
});

export { WEIGHT };
export default router;
