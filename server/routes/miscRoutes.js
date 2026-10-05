import { Router } from 'express';
import { all, get, now } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = Router();

router.get('/leaderboard', (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const rows = all(`
    SELECT u.id, u.username, u.role,
      (SELECT COUNT(DISTINCT s.problem_id) FROM submissions s
         WHERE s.user_id = u.id AND s.mode='submit' AND s.verdict='AC') AS solved,
      (SELECT COUNT(*) FROM submissions s
         WHERE s.user_id = u.id AND s.mode='submit') AS attempts,
      (SELECT COALESCE(SUM(w.points), 0) FROM (
          SELECT DISTINCT s2.problem_id AS pid FROM submissions s2
          WHERE s2.user_id = u.id AND s2.mode='submit' AND s2.verdict='AC') d
        JOIN problems p ON p.id = d.pid
        JOIN (SELECT 'easy' AS difficulty, 100 AS points
              UNION ALL SELECT 'medium', 200
              UNION ALL SELECT 'hard', 300) w ON w.difficulty = p.difficulty) AS points,
      (SELECT MIN(s3.judged_at) FROM submissions s3
         WHERE s3.user_id = u.id AND s3.mode='submit' AND s3.verdict='AC') AS first_ac
    FROM users u
    WHERE u.banned = 0
    ORDER BY points DESC, solved DESC, attempts ASC, first_ac ASC, u.username ASC
    LIMIT ?`, limit);
  res.json({
    leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })),
  });
});

router.get('/stats', (req, res) => {
  const problems = get(`SELECT COUNT(*) AS c FROM problems WHERE visibility='public'`).c;
  const users = get(`SELECT COUNT(*) AS c FROM users WHERE banned=0`).c;
  const submissions = get(`SELECT COUNT(*) AS c FROM submissions WHERE mode='submit'`).c;
  const accepted = get(`SELECT COUNT(*) AS c FROM submissions WHERE mode='submit' AND verdict='AC'`).c;
  const recent = all(`
    SELECT s.id, u.username, p.title AS problem_title, s.verdict, s.status, s.language, s.created_at
    FROM submissions s JOIN users u ON u.id=s.user_id JOIN problems p ON p.id=s.problem_id
    WHERE s.mode='submit' ORDER BY s.id DESC LIMIT 10`);
  res.json({ stats: { problems, users, submissions, accepted, acceptance_rate: submissions ? Math.round((accepted / submissions) * 1000) / 10 : 0 }, recent });
});

router.get('/profile/:username', (req, res) => {
  const u = get('SELECT id, username, role, created_at FROM users WHERE username = ?', req.params.username);
  if (!u || u.role === undefined) return res.status(404).json({ error: 'User not found' });
  const stats = get(
    `SELECT
      (SELECT COUNT(*) FROM submissions WHERE user_id=? AND mode='submit') AS total,
      (SELECT COUNT(*) FROM submissions WHERE user_id=? AND mode='submit' AND verdict='AC') AS accepted,
      (SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id=? AND mode='submit' AND verdict='AC') AS solved`,
    u.id, u.id, u.id
  );
  const solved = all(
    `SELECT p.id, p.title, p.slug, p.difficulty, MIN(s.judged_at) AS solved_at
     FROM submissions s JOIN problems p ON p.id=s.problem_id
     WHERE s.user_id=? AND s.verdict='AC' AND s.mode='submit'
     GROUP BY p.id ORDER BY solved_at`,
    u.id
  );
  res.json({ user: u, stats, solved });
});

router.get('/admin/users-brief', requireAdmin, (req, res) => {
  const rows = all('SELECT id, username, role, banned FROM users ORDER BY username');
  res.json({ users: rows });
});

export default router;
