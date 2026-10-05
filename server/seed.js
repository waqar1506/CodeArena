import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');

let fileRemoved = true;
if (process.argv.includes('--reset')) {
  for (const f of ['codearena.db', 'codearena.db-wal', 'codearena.db-shm']) {
    try {
      fs.rmSync(path.join(DATA_DIR, f), { force: true });
    } catch {
      fileRemoved = false;
      break;
    }
  }
}

const { db, get, run, all, now } = await import('./db.js');
const { hashPassword } = await import('./auth.js');

if (process.argv.includes('--reset') && !fileRemoved) {
  db.exec('PRAGMA foreign_keys = OFF');
  for (const { name } of all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")) {
    db.exec(`DELETE FROM "${name}"`);
  }
  if (get("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")) {
    db.exec('DELETE FROM sqlite_sequence');
  }
  db.exec('PRAGMA foreign_keys = ON');
  console.log('Database reset (tables cleared; the file was still in use).');
} else if (process.argv.includes('--reset')) {
  console.log('Database reset.');
}

if (get('SELECT id FROM users LIMIT 1') && !process.argv.includes('--force')) {
  console.log('Database already seeded. Use --force to re-seed or --reset to start over.');
  process.exit(0);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addUser(username, password, role = 'user') {
  const { salt, hash } = hashPassword(password);
  return Number(run('INSERT INTO users (username, password_hash, salt, role, created_at) VALUES (?,?,?,?,?)', username, hash, salt, role, now()).lastInsertRowid);
}

function addProblem(def) {
  const ts = now();
  const id = Number(
    run(
      `INSERT INTO problems (slug, title, difficulty, tags, statement, input_spec, output_spec, constraints, time_limit_ms, memory_limit_mb, visibility, author_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      def.slug, def.title, def.difficulty, def.tags, def.statement, def.input_spec, def.output_spec, def.constraints,
      def.time_limit_ms || 1000, def.memory_limit_mb || 256, 'public', adminId, ts, ts
    ).lastInsertRowid
  );
  def.tests().forEach((t, i) => {
    run('INSERT INTO test_cases (problem_id, position, input, expected_output, is_sample) VALUES (?,?,?,?,?)', id, i + 1, t.input, t.output, t.sample ? 1 : 0);
  });
  return id;
}

function insertJudgedSubmission({ userId, problemId, language, source, verdict, createdAt, contestId = null }) {
  const total = get('SELECT COUNT(*) AS c FROM test_cases WHERE problem_id = ?', problemId).c;
  const judgedAt = createdAt + 800 + Math.floor(Math.random() * 2500);
  const passed = verdict === 'AC' ? total : Math.max(0, Math.floor(Math.random() * total));
  const id = Number(
    run(
      `INSERT INTO submissions (user_id, problem_id, contest_id, mode, language, source, status, verdict, message, time_ms, memory_kb, score, tests_passed, tests_total, created_at, judged_at)
       VALUES (?,?,?,'submit',?,?,'judged',?,?,?,?,?,?,?,?,?)`,
      userId, problemId, contestId, language, source, verdict,
      verdict === 'CE' ? 'error: compilation failed' : null,
      5 + Math.floor(Math.random() * 400),
      1500 + Math.floor(Math.random() * 20000),
      verdict === 'AC' ? 100 : 0,
      passed, total, createdAt, judgedAt
    ).lastInsertRowid
  );
  for (let i = 1; i <= passed; i++) {
    run('INSERT INTO submission_tests (submission_id, position, verdict, time_ms, memory_kb, message) VALUES (?,?,?,?,?,?)', id, i, 'AC', 3 + Math.floor(Math.random() * 200), 2000 + Math.floor(Math.random() * 8000), null);
  }
  if (verdict !== 'AC') {
    run('INSERT INTO submission_tests (submission_id, position, verdict, time_ms, memory_kb, message) VALUES (?,?,?,?,?,?)', id, passed + 1, verdict, 5, null, verdict === 'WA' ? 'Output does not match expected answer' : 'Runtime error');
  }
  return id;
}

const P = {};

const adminId = addUser('admin', 'admin123', 'admin');
const alice = addUser('alice', 'password123');
const bob = addUser('bob', 'password123');
const carol = addUser('carol', 'password123');
const dave = addUser('dave', 'password123');

P.sum = addProblem({
  slug: 'sum-of-two',
  title: 'A + B',
  difficulty: 'easy',
  tags: 'math,beginner',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  statement: `## Problem

Given two integers $A$ and $B$, print their sum.

This is the classic warm-up problem — read two numbers and add them.

## Input

A single line containing two integers \`A\` and \`B\` separated by a space.

## Output

A single line containing the value of \`A + B\`.

## Constraints

- \`-10^9 <= A, B <= 10^9\`
- The answer always fits in a 64-bit signed integer.`,
  input_spec: 'Two integers on one line.',
  output_spec: 'One integer — the sum.',
  constraints: '-1e9 <= A, B <= 1e9',
  tests: () => {
    const rnd = mulberry32(11);
    const cases = [
      { input: '1 2\n', output: '3\n', sample: true },
      { input: '-5 5\n', output: '0\n', sample: true },
      { input: '1000000000 1000000000\n', output: '2000000000\n' },
      { input: '-1000000000 -1000000000\n', output: '-2000000000\n' },
      { input: '0 0\n', output: '0\n' },
      { input: '7 -13\n', output: '-6\n' },
    ];
    for (let i = 0; i < 4; i++) {
      const a = Math.floor(rnd() * 2e9) - 1e9;
      const b = Math.floor(rnd() * 2e9) - 1e9;
      cases.push({ input: `${a} ${b}\n`, output: `${a + b}\n` });
    }
    return cases;
  },
});

P.fizz = addProblem({
  slug: 'fizzbuzz-range',
  title: 'FizzBuzz',
  difficulty: 'easy',
  tags: 'implementation,beginner',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  statement: `## Problem

For every integer from \`1\` to \`N\` print one line:

- \`FizzBuzz\` if it is divisible by both 3 and 5
- \`Fizz\` if it is divisible by 3
- \`Buzz\` if it is divisible by 5
- the number itself otherwise

## Input

A single line containing one integer \`N\`.

## Output

\`N\` lines, one for each integer from \`1\` to \`N\`.

## Constraints

- \`1 <= N <= 1000\``,
  input_spec: 'One integer N.',
  output_spec: 'N lines.',
  constraints: '1 <= N <= 1000',
  tests: () => {
    const cases = [
      { input: '5\n', output: '1\n2\nFizz\n4\nBuzz\n', sample: true },
      { input: '15\n', output: '1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz\n', sample: true },
      { input: '1\n', output: '1\n' },
      { input: '3\n', output: '1\n2\nFizz\n' },
      { input: '16\n', output: Array.from({ length: 16 }, (_, i) => { const n = i + 1; return n % 15 === 0 ? 'FizzBuzz' : n % 3 === 0 ? 'Fizz' : n % 5 === 0 ? 'Buzz' : String(n); }).join('\n') + '\n' },
      { input: '100\n', output: Array.from({ length: 100 }, (_, i) => { const n = i + 1; return n % 15 === 0 ? 'FizzBuzz' : n % 3 === 0 ? 'Fizz' : n % 5 === 0 ? 'Buzz' : String(n); }).join('\n') + '\n' },
      { input: '1000\n', output: Array.from({ length: 1000 }, (_, i) => { const n = i + 1; return n % 15 === 0 ? 'FizzBuzz' : n % 3 === 0 ? 'Fizz' : n % 5 === 0 ? 'Buzz' : String(n); }).join('\n') + '\n' },
    ];
    return cases;
  },
});

P.reverse = addProblem({
  slug: 'reverse-the-line',
  title: 'Reverse the Line',
  difficulty: 'easy',
  tags: 'strings,beginner',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  statement: `## Problem

Given a line of text, print it reversed.

## Input

A single line containing a string \`S\` (it may contain spaces).

## Output

A single line containing \`S\` reversed.

## Constraints

- \`1 <= |S| <= 100000\`
- \`S\` consists of printable ASCII characters.`,
  input_spec: 'One line of text.',
  output_spec: 'The line reversed.',
  constraints: '1 <= |S| <= 100000',
  tests: () => {
    const cases = [
      { input: 'codearena\n', output: 'anaerdaoc\n', sample: true },
      { input: 'hello world\n', output: 'dlrow olleh\n', sample: true },
      { input: 'a\n', output: 'a\n' },
      { input: 'abba\n', output: 'abba\n' },
      { input: 'racecar is a palindrome\n', output: 'emordnalp a si racer\n' },
      { input: '  leading and trailing  \n', output: '  gniliart dna gnidael  \n' },
      { input: 'A1 b2 C3 !@#\n', output: '#@! 3C 2b 1A\n' },
    ];
    const rnd = mulberry32(42);
    const chars = 'abcdefghijklmnopqrstuvwxyz ABC123';
    let s = '';
    for (let i = 0; i < 5000; i++) s += chars[Math.floor(rnd() * chars.length)];
    cases.push({ input: s + '\n', output: [...s].reverse().join('') + '\n' });
    return cases;
  },
});

P.fib = addProblem({
  slug: 'fibonacci-number',
  title: 'Fibonacci Number',
  difficulty: 'easy',
  tags: 'math,dynamic-programming',
  time_limit_ms: 1000,
  memory_limit_mb: 256,
  statement: `## Problem

The Fibonacci sequence is defined by \`F(0) = 0\`, \`F(1) = 1\` and \`F(n) = F(n-1) + F(n-2)\` for \`n >= 2\`.

Given \`n\`, print \`F(n)\`.

## Input

A single integer \`n\`.

## Output

A single integer \`F(n)\`.

## Constraints

- \`0 <= n <= 90\` (so the answer fits in 64 bits)`,
  input_spec: 'One integer n.',
  output_spec: 'F(n).',
  constraints: '0 <= n <= 90',
  tests: () => {
    const f = [0n, 1n];
    for (let i = 2; i <= 90; i++) f[i] = f[i - 1] + f[i - 2];
    const mk = (n, sample = false) => ({ input: `${n}\n`, output: `${f[n]}\n`, sample });
    return [mk(0, true), mk(10, true), mk(1), mk(2), mk(30), mk(50), mk(70), mk(90)];
  },
});

P.occ = addProblem({
  slug: 'count-occurrences',
  title: 'Count Occurrences',
  difficulty: 'medium',
  tags: 'binary-search,arrays',
  time_limit_ms: 1500,
  memory_limit_mb: 256,
  statement: `## Problem

You are given a **sorted** (non-decreasing) array of \`n\` integers and a value \`x\`.

Count how many times \`x\` occurs in the array.

An \`O(n)\` scan will pass, but an \`O(log n)\` binary search is the intended solution.

## Input

- The first line contains two integers \`n\` and \`x\`.
- The second line contains \`n\` integers \`a1 ... an\` in non-decreasing order.

## Output

A single integer — the number of occurrences of \`x\`.

## Constraints

- \`1 <= n <= 200000\`
- \`-10^9 <= ai, x <= 10^9\``,
  input_spec: 'n and x, then the sorted array.',
  output_spec: 'One integer.',
  constraints: '1 <= n <= 200000',
  tests: () => {
    const cases = [
      { input: '6 3\n1 2 3 3 3 5\n', output: '3\n', sample: true },
      { input: '5 7\n1 2 4 6 8\n', output: '0\n', sample: true },
      { input: '1 42\n42\n', output: '1\n' },
    ];
    const rnd = mulberry32(7);
    for (let i = 0; i < 4; i++) {
      const n = 1000 + Math.floor(rnd() * 5000);
      const x = Math.floor(rnd() * 21) - 10;
      const arr = Array.from({ length: n }, () => Math.floor(rnd() * 21) - 10).sort((a, b) => a - b);
      const expected = arr.filter((v) => v === x).length;
      cases.push({ input: `${n} ${x}\n${arr.join(' ')}\n`, output: `${expected}\n` });
    }
    const n = 200000;
    const x = 123;
    const arr = Array.from({ length: n }, () => Math.floor(rnd() * 1000)).sort((a, b) => a - b);
    arr[Math.floor(n / 2)] = x;
    cases.push({ input: `${n} ${x}\n${arr.join(' ')}\n`, output: `${arr.filter((v) => v === x).length}\n` });
    return cases;
  },
});

P.kadane = addProblem({
  slug: 'maximum-subarray',
  title: 'Maximum Subarray',
  difficulty: 'medium',
  tags: 'dynamic-programming,arrays',
  time_limit_ms: 1500,
  memory_limit_mb: 256,
  statement: `## Problem

Given an array of \`n\` integers (possibly negative), find the **maximum sum of a non-empty contiguous subarray**.

## Input

- The first line contains one integer \`n\`.
- The second line contains \`n\` integers \`a1 ... an\`.

## Output

A single integer — the maximum subarray sum.

## Constraints

- \`1 <= n <= 200000\`
- \`-10^9 <= ai <= 10^9\``,
  input_spec: 'n, then the array.',
  output_spec: 'Maximum subarray sum.',
  constraints: '1 <= n <= 200000',
  tests: () => {
    const solve = (a) => {
      let best = a[0], cur = a[0];
      for (let i = 1; i < a.length; i++) {
        cur = Math.max(a[i], cur + a[i]);
        best = Math.max(best, cur);
      }
      return best;
    };
    const cases = [
      { input: '5\n-2 1 -3 4 -1\n', output: '4\n', sample: true },
      { input: '1\n-7\n', output: '-7\n', sample: true },
      { input: '4\n1 2 3 4\n', output: '10\n' },
      { input: '8\n-1 -2 -3 -4 -5 -6 -7 -8\n', output: '-1\n' },
      { input: '6\n5 -4 3 -2 6 -1\n', output: '8\n' },
    ];
    const rnd = mulberry32(99);
    for (let i = 0; i < 3; i++) {
      const n = 100 + Math.floor(rnd() * 500);
      const a = Array.from({ length: n }, () => Math.floor(rnd() * 2001) - 1000);
      cases.push({ input: `${n}\n${a.join(' ')}\n`, output: `${solve(a)}\n` });
    }
    const n = 200000;
    const a = Array.from({ length: n }, () => Math.floor(rnd() * 2000000001) - 1000000000);
    cases.push({ input: `${n}\n${a.join(' ')}\n`, output: `${solve(a)}\n` });
    return cases;
  },
});

P.lis = addProblem({
  slug: 'longest-increasing-subsequence',
  title: 'Longest Increasing Subsequence',
  difficulty: 'hard',
  tags: 'dynamic-programming,binary-search',
  time_limit_ms: 2000,
  memory_limit_mb: 256,
  statement: `## Problem

Given an array of \`n\` integers, find the length of the longest **strictly increasing** subsequence.

A subsequence is obtained by deleting some (possibly zero) elements without changing the order.

## Input

- The first line contains one integer \`n\`.
- The second line contains \`n\` integers \`a1 ... an\`.

## Output

A single integer — the length of the longest strictly increasing subsequence.

## Constraints

- \`1 <= n <= 100000\`
- \`-10^9 <= ai <= 10^9\`

An \`O(n^2)\` dynamic programming solution will **not** pass; use \`O(n log n)\` with a tails array.`,
  input_spec: 'n, then the array.',
  output_spec: 'Length of the LIS.',
  constraints: '1 <= n <= 100000',
  tests: () => {
    const solve = (a) => {
      const tails = [];
      for (const x of a) {
        let lo = 0, hi = tails.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (tails[mid] < x) lo = mid + 1;
          else hi = mid;
        }
        tails[lo] = x;
      }
      return tails.length;
    };
    const cases = [
      { input: '8\n10 9 2 5 3 7 101 18\n', output: '4\n', sample: true },
      { input: '1\n42\n', output: '1\n', sample: true },
      { input: '5\n5 4 3 2 1\n', output: '1\n' },
      { input: '6\n1 2 2 3 4 5\n', output: '5\n' },
      { input: '7\n-5 -1 -4 -2 -10 -3 -7\n', output: '3\n' },
    ];
    const rnd = mulberry32(1234);
    for (let i = 0; i < 3; i++) {
      const n = 2000 + Math.floor(rnd() * 3000);
      const a = Array.from({ length: n }, () => Math.floor(rnd() * 2001) - 1000);
      cases.push({ input: `${n}\n${a.join(' ')}\n`, output: `${solve(a)}\n` });
    }
    const n = 100000;
    const a = Array.from({ length: n }, () => Math.floor(rnd() * 2000000001) - 1000000000);
    cases.push({ input: `${n}\n${a.join(' ')}\n`, output: `${solve(a)}\n` });
    const seq = Array.from({ length: n }, (_, i) => i);
    cases.push({ input: `${n}\n${seq.join(' ')}\n`, output: `${n}\n` });
    return cases;
  },
});

P.coins = addProblem({
  slug: 'coin-change',
  title: 'Coin Change',
  difficulty: 'hard',
  tags: 'dynamic-programming,greedy-fails',
  time_limit_ms: 2000,
  memory_limit_mb: 256,
  statement: `## Problem

You have coins of \`n\` different denominations. Each coin can be used **unlimited** times.

Find the minimum number of coins needed to make the amount \`amount\`. If it is impossible, print \`-1\`.

**Note:** a greedy strategy does **not** work for arbitrary denominations — use dynamic programming.

## Input

- The first line contains two integers \`n\` and \`amount\`.
- The second line contains \`n\` distinct integers — the coin denominations (each between 1 and 100000).

## Output

A single integer — the minimum number of coins, or \`-1\`.

## Constraints

- \`1 <= n <= 20\`
- \`0 <= amount <= 10000\``,
  input_spec: 'n and amount, then the denominations.',
  output_spec: 'Minimum coins or -1.',
  constraints: '0 <= amount <= 10000',
  tests: () => {
    const solve = (coins, amount) => {
      const INF = Infinity;
      const dp = new Array(amount + 1).fill(INF);
      dp[0] = 0;
      for (let a = 1; a <= amount; a++) {
        for (const c of coins) if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
      }
      return dp[amount] === INF ? -1 : dp[amount];
    };
    const cases = [
      { input: '3 11\n1 2 5\n', output: '3\n', sample: true },
      { input: '2 3\n2 4\n', output: '-1\n', sample: true },
      { input: '1 0\n7\n', output: '0\n' },
      { input: '3 6\n3 7 11\n', output: '-1\n' },
      { input: '4 63\n5 7 3 9\n', output: '7\n' },
      { input: '6 97\n50 25 10 5 2 1\n', output: '5\n' },
    ];
    const rnd = mulberry32(555);
    for (let i = 0; i < 4; i++) {
      const n = 3 + Math.floor(rnd() * 8);
      const coins = [];
      while (coins.length < n) {
        const c = 1 + Math.floor(rnd() * 100);
        if (!coins.includes(c)) coins.push(c);
      }
      const amount = Math.floor(rnd() * 1000);
      cases.push({ input: `${n} ${amount}\n${coins.join(' ')}\n`, output: `${solve(coins, amount)}\n` });
    }
    const coins = [7, 3, 5, 11];
    const amount = 10000;
    cases.push({ input: `4 ${amount}\n${coins.join(' ')}\n`, output: `${solve(coins, amount)}\n` });
    return cases;
  },
});

const ts = now();
const hour = 3600000;
const contest1 = Number(
  run(
    `INSERT INTO contests (title, description, starts_at, ends_at, visibility, created_by, created_at) VALUES (?,?,?,?,?,?,?)`,
    'Starter Sprint',
    'A short 24-hour contest for newcomers. Solve as many problems as you can — wrong submissions add a 20 minute penalty.',
    ts - 6 * hour, ts + 18 * hour, 'public', adminId, ts
  ).lastInsertRowid
);
const contest2 = Number(
  run(
    `INSERT INTO contests (title, description, starts_at, ends_at, visibility, created_by, created_at) VALUES (?,?,?,?,?,?,?)`,
    'Weekend Challenge',
    'A 3-hour weekend round with two classic algorithm problems. Register now — the problems unlock when it starts.',
    ts + 3 * 24 * hour, ts + 3 * 24 * hour + 3 * hour, 'public', adminId, ts
  ).lastInsertRowid
);

for (const [pos, pid, score] of [[1, P.sum, 100], [2, P.fizz, 100], [3, P.kadane, 200], [4, P.occ, 200]]) {
  run('INSERT INTO contest_problems (contest_id, problem_id, position, score) VALUES (?,?,?,?)', contest1, pid, pos, score);
}
for (const [pos, pid, score] of [[1, P.occ, 100], [2, P.coins, 300]]) {
  run('INSERT INTO contest_problems (contest_id, problem_id, position, score) VALUES (?,?,?,?)', contest2, pid, pos, score);
}
for (const uid of [alice, bob, carol]) {
  run('INSERT OR IGNORE INTO contest_registrations (contest_id, user_id, registered_at) VALUES (?,?,?)', contest1, uid, ts - 8 * hour);
}

const solutions = {
  [P.sum]: 'print(*[sum(map(int, input().split()))])\n',
  [P.fizz]: 'n=int(input())\nfor i in range(1,n+1):\n    print("FizzBuzz" if i%15==0 else "Fizz" if i%3==0 else "Buzz" if i%5==0 else i)\n',
  [P.reverse]: 'print(input()[::-1])\n',
  [P.fib]: 'n=int(input())\na,b=0,1\nfor _ in range(n): a,b=b,a+b\nprint(a)\n',
  [P.occ]: 'import bisect\nn,x=map(int,input().split())\na=list(map(int,input().split()))\nprint(bisect.bisect_right(a,x)-bisect.bisect_left(a,x))\n',
  [P.kadane]: 'n=int(input())\na=list(map(int,input().split()))\nb=c=a[0]\nfor v in a[1:]:\n    c=max(v,c+v)\n    b=max(b,c)\nprint(b)\n',
  [P.lis]: 'import bisect\nn=int(input())\na=list(map(int,input().split()))\nt=[]\nfor x in a:\n    i=bisect.bisect_left(t,x)\n    if i==len(t): t.append(x)\n    else: t[i]=x\nprint(len(t))\n',
  [P.coins]: 'n,amount=map(int,input().split())\ncoins=list(map(int,input().split()))\nINF=10**9\ndp=[0]+[INF]*amount\nfor a in range(1,amount+1):\n    for c in coins:\n        if c<=a and dp[a-c]+1<dp[a]: dp[a]=dp[a-c]+1\nprint(-1 if dp[amount]>=INF else dp[amount])\n',
};

const day = 86400000;
const subs = [
  { uid: alice, pid: P.sum, v: 'AC', t: ts - 5 * day },
  { uid: alice, pid: P.fizz, v: 'AC', t: ts - 5 * day + 3000 },
  { uid: alice, pid: P.reverse, v: 'AC', t: ts - 4 * day },
  { uid: alice, pid: P.fib, v: 'AC', t: ts - 3 * day },
  { uid: alice, pid: P.kadane, v: 'AC', t: ts - 2 * day },
  { uid: bob, pid: P.sum, v: 'AC', t: ts - 5 * day + 60000 },
  { uid: bob, pid: P.fizz, v: 'WA', t: ts - 4 * day },
  { uid: bob, pid: P.fizz, v: 'AC', t: ts - 4 * day + 4000 },
  { uid: bob, pid: P.reverse, v: 'AC', t: ts - 3 * day },
  { uid: bob, pid: P.occ, v: 'WA', t: ts - 2 * day },
  { uid: carol, pid: P.sum, v: 'AC', t: ts - 4 * day },
  { uid: carol, pid: P.reverse, v: 'WA', t: ts - 3 * day },
  { uid: carol, pid: P.reverse, v: 'AC', t: ts - 3 * day + 2000 },
  { uid: dave, pid: P.sum, v: 'AC', t: ts - 2 * day },
  { uid: dave, pid: P.fizz, v: 'RE', t: ts - 2 * day + 5000 },
  { uid: carol, pid: P.fib, v: 'CE', t: ts - day },
];
for (const s of subs) {
  insertJudgedSubmission({
    userId: s.uid,
    problemId: s.pid,
    language: 'python',
    source: solutions[s.pid] || '# solution\n',
    verdict: s.v,
    createdAt: s.t,
  });
}

const contestSubs = [
  { uid: alice, pid: P.sum, t: ts - 5 * hour },
  { uid: alice, pid: P.fizz, t: ts - 4 * hour },
  { uid: alice, pid: P.kadane, t: ts - 2 * hour },
  { uid: bob, pid: P.sum, t: ts - 3 * hour },
  { uid: bob, pid: P.fizz, v: 'WA', t: ts - 3 * hour + 60000 },
  { uid: bob, pid: P.fizz, t: ts - 3 * hour + 90000 },
  { uid: carol, pid: P.sum, t: ts - 1 * hour },
];
for (const s of contestSubs) {
  insertJudgedSubmission({
    userId: s.uid,
    problemId: s.pid,
    language: 'python',
    source: solutions[s.pid] || '# solution\n',
    verdict: s.v || 'AC',
    createdAt: s.t,
    contestId: contest1,
  });
}

console.log('Seed complete.');
console.log('  Admin login : admin / admin123');
console.log('  Demo users  : alice, bob, carol, dave / password123');
console.log(`  Problems    : ${all('SELECT id FROM problems').length}`);
console.log(`  Test cases  : ${get('SELECT COUNT(*) AS c FROM test_cases').c}`);
console.log(`  Submissions : ${get('SELECT COUNT(*) AS c FROM submissions').c}`);
console.log(`  Contests    : ${all('SELECT id FROM contests').length}`);
