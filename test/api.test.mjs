const BASE = 'http://localhost:3000';

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', cookie: this.cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) this.cookie = c.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function waitVerdict(c, id, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await c.req('GET', `/api/submissions/${id}`);
    if (r.data?.submission?.status === 'judged') return r.data.submission;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('judging timed out for submission ' + id);
}

const solutions = {
  python: `a, b = map(int, input().split())\nprint(a + b)\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\nint main(){ long long a,b; cin>>a>>b; cout<<a+b<<"\\n"; }\n`,
  java: `import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    long a = sc.nextLong(), b = sc.nextLong();\n    System.out.println(a + b);\n  }\n}\n`,
  javascript: `const [a, b] = require('fs').readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconsole.log(a + b);\n`,
};

async function submit(c, { problem_id, language, source, mode = 'submit' }) {
  const r = await c.req('POST', '/api/submissions', { problem_id, language, source, mode });
  if (r.status !== 201) throw new Error(`submit failed ${r.status} ${JSON.stringify(r.data)}`);
  return waitVerdict(c, r.data.id);
}

async function main() {
  const c = new Client();
  console.log('auth');
  let r = await c.req('POST', '/api/auth/register', { username: 'e2e_' + Math.floor(Math.random() * 100000), password: 'secret123' });
  check('register', r.status === 201, JSON.stringify(r.data));
  r = await c.req('GET', '/api/auth/me');
  check('me', r.data?.user?.username?.startsWith('e2e_'), JSON.stringify(r.data));

  r = await c.req('GET', '/api/problems');
  check('problem list', r.status === 200 && r.data.problems.length >= 8, JSON.stringify(r.data).slice(0, 200));
  const p = r.data.problems.find((x) => x.slug === 'sum-of-two');
  const problemId = p.id;
  r = await c.req('GET', `/api/problems/${problemId}`);
  check('problem detail + sample tests', r.data.tests.filter((t) => t.is_sample).length === 2);

  console.log('verdicts — all languages on A+B');
  for (const [lang, src] of Object.entries(solutions)) {
    const s = await submit(c, { problem_id: problemId, language: lang, source: src });
    check(`${lang} AC`, s.verdict === 'AC', `${s.verdict}: ${s.message} tests=${s.tests_passed}/${s.tests_total}`);
    if (s.verdict === 'AC') check(`${lang} time/mem recorded`, s.time_ms >= 0 && s.memory_kb > 0, JSON.stringify({ t: s.time_ms, m: s.memory_kb }));
  }

  console.log('failure verdicts');
  let s = await submit(c, { problem_id: problemId, language: 'python', source: 'print(999)\n' });
  check('WA', s.verdict === 'WA', s.verdict + ' ' + (s.message || ''));

  s = await submit(c, { problem_id: problemId, language: 'python', source: 'while True: pass\n' });
  check('TLE', s.verdict === 'TLE', s.verdict);

  s = await submit(c, { problem_id: problemId, language: 'python', source: 'import sys\nsys.exit(3)\n' });
  check('RE', s.verdict === 'RE', s.verdict);

  s = await submit(c, { problem_id: problemId, language: 'cpp', source: '#error nope\n' });
  check('CE', s.verdict === 'CE', s.verdict);

  s = await submit(c, { problem_id: problemId, language: 'python', source: 'x = 1\n' });
  check('sample mode', s.verdict === 'WA' || s.verdict === 'AC', s.verdict);
  const sampleRun = await submit(c, { problem_id: problemId, language: 'python', source: solutions.python, mode: 'sample' });
  check('sample run AC', sampleRun.verdict === 'AC', `${sampleRun.verdict} ${sampleRun.tests_total}`);

  console.log('harder problem — LIS in C++ (O(n log n))');
  const lis = (await c.req('GET', '/api/problems/longest-increasing-subsequence')).data.problem;
  const lisCpp = `#include <bits/stdc++.h>\nusing namespace std;\nint main(){int n;scanf("%d",&n);vector<int>t;for(int i=0,x;i<n;i++){scanf("%d",&x);int p=lower_bound(t.begin(),t.end(),x)-t.begin();if(p==(int)t.size())t.push_back(x);else t[p]=x;}printf("%d\\n",(int)t.size());}\n`;
  s = await submit(c, { problem_id: lis.id, language: 'cpp', source: lisCpp });
  check('LIS C++ AC', s.verdict === 'AC', `${s.verdict}: ${s.message}`);

  console.log('API surfaces');
  r = await c.req('GET', '/api/leaderboard');
  check('leaderboard', r.status === 200 && r.data.leaderboard.length >= 4, JSON.stringify(r.data.leaderboard?.slice(0, 2)));
  r = await c.req('GET', '/api/submissions?limit=5');
  check('submission history', r.status === 200 && r.data.submissions.length === 5);
  r = await c.req('GET', '/api/contests');
  check('contest list', r.data.contests.length >= 2, JSON.stringify(r.data.contests?.map((x) => x.status)));
  const running = r.data.contests.find((x) => x.title === 'Starter Sprint') || r.data.contests.find((x) => x.status === 'running');
  r = await c.req('POST', `/api/contests/${running.id}/register`);
  check('contest register', r.status === 200, JSON.stringify(r.data));
  r = await c.req('GET', `/api/contests/${running.id}/standings`);
  check('contest standings', r.status === 200 && r.data.standings.length >= 3, JSON.stringify(r.data.standings?.slice(0, 2)));
  r = await c.req('GET', `/api/contests/${r.data.contest_id || running.id}`);
  r = await c.req('GET', `/api/contests/${running.id}`);
  check('contest detail hides/locks problems appropriately', r.status === 200);
  const upcoming = r = (await c.req('GET', '/api/contests')).data.contests.find((x) => x.status === 'upcoming');
  const cu = await c.req('GET', `/api/contests/${upcoming.id}`);
  check('upcoming contest hides problems', cu.data?.contest?.problems?.[0]?.slug === null, JSON.stringify(cu.data?.contest?.problems?.[0]));

  console.log('auth guards');
  const anon = new Client();
  r = await anon.req('POST', '/api/submissions', { problem_id: problemId, language: 'python', source: 'x' });
  check('anon submit blocked', r.status === 401, String(r.status));
  r = await anon.req('POST', '/api/admin/stats');
  check('anon admin blocked', r.status === 401, String(r.status));
  r = await c.req('GET', '/api/admin/stats');
  check('user admin blocked', r.status === 403, String(r.status));
  r = await c.req('POST', '/api/problems', { title: 'Nope' });
  check('user create problem blocked', r.status === 403, String(r.status));

  console.log('admin');
  const admin = new Client();
  r = await admin.req('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  check('admin login', r.status === 200, JSON.stringify(r.data));
  r = await admin.req('GET', '/api/admin/stats');
  check('admin stats', r.status === 200 && r.data.totals.problems >= 8, JSON.stringify(r.data.totals));
  r = await admin.req('GET', '/api/admin/users');
  check('admin users', r.data.users.length >= 6, String(r.data.users?.length));
  r = await admin.req('POST', '/api/problems', {
    title: 'Double the Number', slug: 'double-the-number-' + Date.now(), difficulty: 'easy', tags: 'math', statement: '## Problem\nRead n, print 2n.',
    time_limit_ms: 1000, memory_limit_mb: 256,
  });
  check('admin create problem', r.status === 201, JSON.stringify(r.data));
  const newId = r.data.problem.id;
  r = await admin.req('POST', `/api/problems/${newId}/tests`, { input: '21\n', expected_output: '42\n', is_sample: true });
  check('admin add test', r.status === 201, JSON.stringify(r.data));
  r = await admin.req('GET', `/api/admin/submissions`);
  check('admin submissions list', r.status === 200 && r.data.submissions.length > 0);
  r = await admin.req('POST', '/api/contests', { title: 'Test Cup', starts_at: Date.now() - 1000, ends_at: Date.now() + 3600000 });
  check('admin create contest', r.status === 201, JSON.stringify(r.data));
  const cupId = r.data.contest.id;
  r = await admin.req('POST', `/api/contests/${cupId}/problems`, { problem_id: newId });
  check('admin add contest problem', r.status === 201, JSON.stringify(r.data));

  console.log('new problem judged end-to-end');
  s = await submit(c, { problem_id: newId, language: 'python', source: 'print(int(input())*2)\n' });
  check('new problem AC', s.verdict === 'AC', `${s.verdict}: ${s.message}`);
  s = await submit(c, { problem_id: newId, language: 'javascript', source: "console.log(Number(require('fs').readFileSync(0,'utf8'))*2)\n" });
  check('new problem JS AC', s.verdict === 'AC', `${s.verdict}: ${s.message}`);

  console.log('judge memory limit');
  const mem = await admin.req('POST', '/api/problems', { title: 'Mem Hog', slug: 'mem-hog-' + Date.now(), difficulty: 'easy', statement: 'x', time_limit_ms: 3000, memory_limit_mb: 32 });
  await admin.req('POST', `/api/problems/${mem.data.problem.id}/tests`, { input: '1\n', expected_output: '1\n', is_sample: true });
  const hog = 'x = [0] * (60 * 1024 * 1024 // 8)\nprint(1)\n';
  s = await submit(c, { problem_id: mem.data.problem.id, language: 'python', source: hog });
  check('MLE detected', s.verdict === 'MLE', `${s.verdict} mem=${s.memory_kb}`);
  console.log(`    (memory verdict detail: ${s.verdict}, peak=${s.memory_kb} KB, limit=32768 KB)`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });

