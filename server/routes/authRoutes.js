import { Router } from 'express';
import { get, run, now } from '../db.js';
import { hashPassword, verifyPassword, createSession, destroySession, setSessionCookie, clearSessionCookie, requireAuth } from '../auth.js';
import { sanitizeUsername } from '../util.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, created_at: u.created_at };
}

router.post('/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!sanitizeUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-24 chars: letters, numbers, underscore' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (get('SELECT id FROM users WHERE username = ?', username)) {
    return res.status(409).json({ error: 'Username is already taken' });
  }
  const { salt, hash } = hashPassword(password);
  const role = get('SELECT id FROM users') ? 'user' : 'admin';
  const r = run('INSERT INTO users (username, password_hash, salt, role, created_at) VALUES (?,?,?,?,?)', username, hash, salt, role, now());
  const user = get('SELECT * FROM users WHERE id = ?', Number(r.lastInsertRowid));
  const s = createSession(user.id);
  setSessionCookie(res, s.token, s.expires);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = get('SELECT * FROM users WHERE username = ?', String(username || ''));
  if (!user || !verifyPassword(String(password || ''), user.salt, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  if (user.banned) return res.status(403).json({ error: 'This account has been suspended' });
  const s = createSession(user.id);
  setSessionCookie(res, s.token, s.expires);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  destroySession(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const u = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: u ? publicUser(u) : null });
});

router.get('/stats', requireAuth, (req, res) => {
  const s = get(
    `SELECT
      (SELECT COUNT(*) FROM submissions WHERE user_id = ? AND mode='submit') AS total,
      (SELECT COUNT(*) FROM submissions WHERE user_id = ? AND mode='submit' AND verdict='AC') AS accepted,
      (SELECT COUNT(DISTINCT problem_id) FROM submissions WHERE user_id = ? AND mode='submit' AND verdict='AC') AS solved`,
    req.user.id, req.user.id, req.user.id
  );
  res.json({ stats: s });
});

export default router;
