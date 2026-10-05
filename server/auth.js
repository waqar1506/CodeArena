import crypto from 'node:crypto';
import { get, run, now } from './db.js';

const SESSION_TTL = 1000 * 60 * 60 * 24 * 14;
const SESSION_COOKIE = 'ca_session';

export function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), s, 64).toString('hex');
  return { salt: s, hash };
}

export function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const ts = now();
  run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, userId, ts, ts + SESSION_TTL);
  return { token, expires: ts + SESSION_TTL };
}

export function destroySession(token) {
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionMiddleware(req, res, next) {
  req.user = null;
  req.sessionToken = null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    const row = get('SELECT s.token, s.expires_at, u.id, u.username, u.role, u.banned FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', token);
    if (row && row.expires_at > now() && !row.banned) {
      req.user = { id: row.id, username: row.username, role: row.role };
      req.sessionToken = token;
    }
  }
  next();
}

export function setSessionCookie(res, token, expires) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expires).toUTCString()}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}
