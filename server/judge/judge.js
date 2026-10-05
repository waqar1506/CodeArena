import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, all, run, JOBS_DIR, DATA_DIR } from '../db.js';
import { getLanguage, sourceFileName, compileCommand, runCommand } from './languages.js';
import { outputsMatch } from '../util.js';

const OUTPUT_LIMIT_BYTES = 1024 * 1024;
const COMPILE_TIMEOUT_MS = 20000;
const RUN_BUFFER_LIMIT = 64 * 1024;
const STARTUP_ALLOWANCE = { cpp: 0, python: 300, javascript: 300, java: 2000 };
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));

let memwatchBuild = null;
export function ensureMemwatch() {
  if (memwatchBuild) return memwatchBuild;
  memwatchBuild = new Promise((resolve) => {
    try {
      const binDir = path.join(DATA_DIR, 'bin');
      fs.mkdirSync(binDir, { recursive: true });
      const exe = path.join(binDir, 'memwatch.exe');
      const src = path.join(MODULE_DIR, 'memwatch.cpp');
      const fresh = fs.existsSync(exe) && fs.statSync(exe).mtimeMs >= fs.statSync(src).mtimeMs;
      if (fresh) return resolve(exe);
      execFile('g++', ['-O2', '-o', exe, src, '-lpsapi'], { timeout: 30000, windowsHide: true }, (err) => {
        if (err) {
          console.warn('[judge] memwatch build failed:', err.message);
          return resolve(null);
        }
        resolve(exe);
      });
    } catch (e) {
      console.warn('[judge] memwatch build error:', e.message);
      resolve(null);
    }
  });
  return memwatchBuild;
}

function startMemwatch(pid, limitKb) {
  return ensureMemwatch().then((exe) => {
    if (!exe || !pid) return null;
    let proc;
    try {
      proc = spawn(exe, [String(pid), String(Math.max(0, Math.round(limitKb || 0)))], {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
    } catch {
      return null;
    }
    return new Promise((resolve) => {
      let out = '';
      proc.stdout.on('data', (d) => { if (out.length < 200) out += d; });
      proc.on('error', () => resolve({ peakKb: null, exceeded: false }));
      proc.on('close', (code) => {
        const m = out.match(/(\d+)/);
        resolve({ peakKb: m ? Number(m[1]) : null, exceeded: code === 42 });
      });
    });
  });
}

function compileJob(jobDir, langId, files) {
  const cmd = compileCommand(langId, files);
  if (!cmd) return Promise.resolve({ ok: true, message: '' });
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd.cmd, cmd.args, { cwd: jobDir, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ ok: false, message: 'Failed to start compiler: ' + e.message });
    }
    let out = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch {}
    }, COMPILE_TIMEOUT_MS);
    child.stdout.on('data', (d) => { if (out.length < 16000) out += d; });
    child.stderr.on('data', (d) => { if (out.length < 16000) out += d; });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, message: 'Compiler error: ' + e.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return resolve({ ok: false, message: 'Compilation timed out.' });
      if (code === 0) return resolve({ ok: true, message: '' });
      resolve({ ok: false, message: out.trim() || `Compiler exited with code ${code}` });
    });
  });
}

function runTest(jobDir, lang, files, testCase, limits) {
  return new Promise((resolve) => {
    const rl = runCommand(lang.id, files, limits);
    let child;
    try {
      child = spawn(rl.cmd, rl.args, { cwd: jobDir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      return resolve({ verdict: 'RE', message: 'Failed to start program: ' + e.message, timeMs: 0, memoryKb: null });
    }

    const start = process.hrtime.bigint();
    let stdout = '';
    let stderr = '';
    let outBytes = 0;
    let killedByTime = false;
    let killedByOutput = false;
    let killedByMemory = false;
    let spawnError = null;

    const memPromise = startMemwatch(child.pid, limits.memoryKb);
    memPromise.then((mem) => {
      if (mem && mem.exceeded && !killedByTime && !killedByOutput && !killedByMemory) {
        killedByMemory = true;
        try { child.kill(); } catch {}
      }
    });
    const timer = setTimeout(() => {
      killedByTime = true;
      try { child.kill(); } catch {}
    }, limits.timeMs);

    child.stdout.on('data', (d) => {
      outBytes += d.length;
      if (outBytes > OUTPUT_LIMIT_BYTES) {
        killedByOutput = true;
        try { child.kill(); } catch {}
      } else {
        stdout += d.toString('utf8');
      }
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < RUN_BUFFER_LIMIT) stderr += d.toString('utf8');
    });
    child.on('error', (e) => { spawnError = e; });
    child.stdin.on('error', () => {});
    try {
      child.stdin.end(testCase.input ?? '');
    } catch {}

    child.on('close', (code) => {
      clearTimeout(timer);
      const timeMs = Number(process.hrtime.bigint() - start) / 1e6;
      memPromise.then((mem) => {
        const peakKb = mem?.peakKb ?? null;
        const exceeded = !!mem?.exceeded || (peakKb != null && peakKb > limits.memoryKb);
        const stderrText = stderr.trim();

        if (spawnError) {
          return resolve({ verdict: 'RE', message: 'Failed to start program: ' + spawnError.message, timeMs, memoryKb: peakKb });
        }
        if (killedByTime) {
          return resolve({ verdict: 'TLE', message: `Exceeded ${limits.limitMs} ms limit`, timeMs: limits.limitMs, memoryKb: peakKb });
        }
        if (killedByOutput) {
          return resolve({ verdict: 'OLE', message: 'Output limit exceeded (1 MB)', timeMs, memoryKb: peakKb });
        }
        if (killedByMemory || exceeded) {
          return resolve({ verdict: 'MLE', message: `Exceeded ${limits.memoryKb} KB limit`, timeMs, memoryKb: peakKb });
        }
        if (lang.id === 'java' && /OutOfMemoryError/i.test(stderrText)) {
          return resolve({ verdict: 'MLE', message: 'JVM ran out of memory', timeMs, memoryKb: peakKb });
        }
        if (lang.id === 'javascript' && /heap out of memory/i.test(stderrText)) {
          return resolve({ verdict: 'MLE', message: 'V8 heap exhausted', timeMs, memoryKb: peakKb });
        }
        if (code !== 0) {
          const msg = stderrText || `Process exited with code ${code}`;
          return resolve({ verdict: 'RE', message: msg.slice(0, 4000), timeMs, memoryKb: peakKb });
        }
        if (!outputsMatch(stdout, testCase.expected_output)) {
          let msg = 'Output does not match expected answer';
          if (testCase.is_sample) {
            const clip = (s) => (s.length > 600 ? s.slice(0, 600) + '…' : s);
            msg = `expected:\n${clip(testCase.expected_output)}\n\nactual:\n${clip(stdout)}`;
          }
          return resolve({ verdict: 'WA', message: msg, timeMs, memoryKb: peakKb });
        }
        resolve({ verdict: 'AC', message: '', timeMs, memoryKb: peakKb });
      });
    });
  });
}

function finalize(id, fields) {
  run(
    `UPDATE submissions SET status='judged', verdict=?, message=?, time_ms=?, memory_kb=?, score=?, tests_passed=?, tests_total=?, judged_at=? WHERE id=?`,
    fields.verdict,
    fields.message ?? null,
    fields.timeMs ?? null,
    fields.memoryKb ?? null,
    fields.score ?? 0,
    fields.testsPassed ?? 0,
    fields.testsTotal ?? 0,
    Date.now(),
    id
  );
}

export async function judgeSubmission(id) {
  const sub = get('SELECT * FROM submissions WHERE id = ?', id);
  if (!sub || sub.status === 'judged') return;
  run(`UPDATE submissions SET status='running' WHERE id=?`, id);

  const lang = getLanguage(sub.language);
  const jobDir = path.join(JOBS_DIR, String(id));
  fs.mkdirSync(jobDir, { recursive: true });

  const fail = (verdict, message, extra = {}) =>
    finalize(id, {
      verdict,
      message,
      timeMs: extra.timeMs ?? 0,
      memoryKb: extra.memoryKb ?? null,
      score: 0,
      testsPassed: 0,
      testsTotal: extra.testsTotal ?? 0,
    });

  try {
    if (!lang) return fail('IE', `Unknown language "${sub.language}"`);
    const problem = get('SELECT * FROM problems WHERE id = ?', sub.problem_id);
    if (!problem) return fail('IE', 'Problem no longer exists');

    const fileName = sourceFileName(sub.language, sub.source);
    fs.writeFileSync(path.join(jobDir, fileName), sub.source, 'utf8');
    const files = { source: fileName };

    const c = await compileJob(jobDir, lang.id, files);
    if (!c.ok) return fail('CE', c.message.slice(0, 12000));

    const tests =
      sub.mode === 'sample'
        ? all('SELECT * FROM test_cases WHERE problem_id = ? AND is_sample = 1 ORDER BY position', sub.problem_id)
        : all('SELECT * FROM test_cases WHERE problem_id = ? ORDER BY position', sub.problem_id);

    if (!tests.length) return fail('IE', 'This problem has no test cases yet', { testsTotal: 0 });

    const limits = {
      timeMs: problem.time_limit_ms + (STARTUP_ALLOWANCE[lang.id] || 0),
      limitMs: problem.time_limit_ms,
      memoryKb: problem.memory_limit_mb * 1024,
      memoryMb: problem.memory_limit_mb,
    };
    let verdict = 'AC';
    let message = '';
    let passed = 0;
    let maxTime = 0;
    let maxMem = 0;

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      const r = await runTest(jobDir, lang, files, t, limits);
      const memKb = r.memoryKb || 0;
      maxTime = Math.max(maxTime, Math.round(r.timeMs || 0));
      maxMem = Math.max(maxMem, Math.round(memKb || 0));
      run(
        'INSERT INTO submission_tests (submission_id, position, verdict, time_ms, memory_kb, message) VALUES (?,?,?,?,?,?)',
        id,
        i + 1,
        r.verdict,
        Math.round(r.timeMs || 0),
        r.memoryKb ? Math.round(r.memoryKb) : null,
        r.message ? String(r.message).slice(0, 6000) : null
      );
      if (r.verdict !== 'AC') {
        verdict = r.verdict;
        message = `Failed on test #${i + 1}${r.message ? '\n' + r.message : ''}`;
        break;
      }
      passed++;
    }

    finalize(id, {
      verdict,
      message,
      timeMs: maxTime,
      memoryKb: maxMem || null,
      score: verdict === 'AC' ? 100 : 0,
      testsPassed: passed,
      testsTotal: tests.length,
    });
  } catch (e) {
    try { fail('IE', 'Judge error: ' + (e?.message || e)); } catch {}
  } finally {
    fs.rmSync(jobDir, { recursive: true, force: true });
  }
}

const queue = [];
let draining = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const id = queue.shift();
    try {
      await judgeSubmission(id);
    } catch (e) {
      try { finalize(id, { verdict: 'IE', message: String(e?.message || e), score: 0 }); } catch {}
    }
  }
  draining = false;
}

export function enqueue(id) {
  queue.push(id);
  drain();
}

export function queueDepth() {
  return queue.length + (draining ? 1 : 0);
}
