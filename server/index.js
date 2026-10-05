import express from 'express';
import path from 'node:path';
import { ROOT } from './db.js';
import { sessionMiddleware } from './auth.js';
import authRoutes from './routes/authRoutes.js';
import problemRoutes from './routes/problemRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';
import contestRoutes from './routes/contestRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import miscRoutes from './routes/miscRoutes.js';
import { ensureMemwatch } from './judge/judge.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', miscRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(ROOT, 'public', 'index.html'));
  }
  next();
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`CodeArena judge running at http://localhost:${PORT}`);
  ensureMemwatch().then((exe) => {
    if (exe) console.log('[judge] memory watcher ready:', exe);
    else console.warn('[judge] memory watcher unavailable — memory limits will be advisory only');
  });
});
