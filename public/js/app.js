/* CodeArena frontend */
(() => {
  "use strict";

  const app = document.getElementById("app");
  const authArea = document.getElementById("auth-area");
  const navAdmin = document.getElementById("nav-admin");

  let ME = null;
  let LANGS = [];
  let pollers = [];

  const VERDICTS = {
    AC: "Accepted", WA: "Wrong Answer", TLE: "Time Limit Exceeded",
    MLE: "Memory Limit Exceeded", RE: "Runtime Error", CE: "Compilation Error",
    OLE: "Output Limit Exceeded", IE: "Internal Error",
  };

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function md(src) {
    const lines = String(src ?? "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let inCode = false, buf = [], list = null;
    const closeList = () => {
      if (list) { out.push(list === "ul" ? "</ul>" : "</ol>"); list = null; }
    };
    const inline = (t) => esc(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    for (const raw of lines) {
      if (raw.startsWith("```")) {
        if (inCode) { out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>"); buf = []; inCode = false; }
        else { closeList(); inCode = true; }
        continue;
      }
      if (inCode) { buf.push(raw); continue; }
      const h = raw.match(/^(#{1,4})\s+(.*)$/);
      if (h) { closeList(); const l = h[1].length + 2; out.push(`<h${l}>${inline(h[2])}</h${l}>`); continue; }
      const li = raw.match(/^\s*[-*]\s+(.*)$/);
      if (li) {
        if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; }
        out.push(`<li>${inline(li[1])}</li>`); continue;
      }
      const ol = raw.match(/^\s*\d+\.\s+(.*)$/);
      if (ol) {
        if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; }
        out.push(`<li>${inline(ol[1])}</li>`); continue;
      }
      if (!raw.trim()) { closeList(); continue; }
      closeList();
      out.push(`<p>${inline(raw)}</p>`);
    }
    if (inCode) out.push("<pre><code>" + esc(buf.join("\n")) + "</code></pre>");
    closeList();
    return out.join("\n");
  }

  async function api(path, opts = {}) {
    const init = { method: opts.method || "GET", headers: {} };
    if (opts.body !== undefined) {
      init.headers["content-type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, init);
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
    return data;
  }

  function toast(msg, type = "err") {
    const box = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }
  const fail = (e) => toast(e.message || String(e));

  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    return Math.floor(s / 86400) + "d ago";
  };
  const fmtDate = (ts) => new Date(ts).toLocaleString();
  function fmtLeft(ms) {
    if (ms <= 0) return "00:00:00";
    const t = Math.floor(ms / 1000);
    const h = String(Math.floor(t / 3600)).padStart(2, "0");
    const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
    const s = String(t % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  const difficultyBadge = (d) => `<span class="badge badge-${esc(d)}">${esc(d)}</span>`;
  const verdictBadge = (v, status) => {
    if (!v) return `<span class="verdict v-pending">${status === "running" ? "Running…" : "In queue"}</span>`;
    return `<span class="verdict v-${esc(v)}">${esc(VERDICTS[v] || v)}</span>`;
  };
  const initials = (name) => String(name || "?").slice(0, 2).toUpperCase();
  const memStr = (kb) => (kb == null ? "—" : kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB");

  function stopPollers() {
    pollers.forEach((t) => clearInterval(t));
    pollers = [];
  }
  const every = (ms, fn) => { const t = setInterval(fn, ms); pollers.push(t); return t; };

  /* ---------------- auth UI ---------------- */
  function renderAuthArea() {
    if (ME) {
      authArea.innerHTML = `
        <div class="user-chip">
          <a href="#/profile/${esc(ME.username)}" class="user-chip" style="color:var(--text)">
            <span class="avatar">${esc(initials(ME.username))}</span>
            <span>${esc(ME.username)}</span>
            ${ME.role === "admin" ? '<span class="badge badge-admin">admin</span>' : ""}
          </a>
          <button class="btn btn-sm btn-ghost" id="logout-btn">Log out</button>
        </div>`;
      document.getElementById("logout-btn").onclick = async () => {
        try { await api("/api/auth/logout", { method: "POST" }); } catch {}
        ME = null;
        renderAuthArea();
        toast("Signed out", "ok");
        location.hash = "#/";
        route();
      };
      navAdmin.hidden = ME.role !== "admin";
    } else {
      authArea.innerHTML = `
        <a class="btn btn-sm btn-ghost" href="#/login">Log in</a>
        <a class="btn btn-sm btn-primary" href="#/register">Sign up</a>`;
      navAdmin.hidden = true;
    }
  }

  /* ---------------- pages ---------------- */
  async function pageHome() {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    const [statsResp, lbResp, contestsResp] = await Promise.all([
      api("/api/stats"), api("/api/leaderboard?limit=5"), api("/api/contests"),
    ]);
    const stats = statsResp.stats;
    const recent = statsResp.recent;
    const leaderboard = lbResp.leaderboard;
    const contests = contestsResp.contests;
    const running = contests.find((c) => c.status === "running");
    const upcoming = contests.find((c) => c.status === "upcoming");

    app.innerHTML = `
      <section class="hero">
        <h1>Write code. Get judged. Climb the board.</h1>
        <p>CodeArena is a complete online judge: 8 curated problems, instant verdicts
        (Accepted, Wrong Answer, TLE, MLE, Runtime Error, Compilation Error), time and memory limits,
        contests with live standings, and a global leaderboard.</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#/problems">Solve problems</a>
          <a class="btn" href="#/contests">View contests</a>
          <a class="btn btn-ghost" href="#/leaderboard">Leaderboard</a>
        </div>
      </section>

      <div class="stat-cards">
        <div class="stat-card"><div class="num">${stats.problems}</div><div class="lbl">Problems</div></div>
        <div class="stat-card"><div class="num">${stats.users}</div><div class="lbl">Coders</div></div>
        <div class="stat-card"><div class="num">${stats.submissions}</div><div class="lbl">Submissions</div></div>
        <div class="stat-card"><div class="num">${stats.acceptance_rate}%</div><div class="lbl">Acceptance</div></div>
      </div>

      ${(running || upcoming) ? `
      <div class="panel" style="margin-bottom:18px;border-color:rgba(77,163,255,.4)">
        <div class="contest-card">
          <div>
            <span class="status-pill status-${running ? "running" : "upcoming"}">${running ? "Running now" : "Upcoming"}</span>
            <strong style="margin-left:10px">${esc((running || upcoming).title)}</strong>
            <div class="muted" style="font-size:13.5px">${esc((running || upcoming).description || "").slice(0, 140)}</div>
          </div>
          <a class="btn btn-primary" href="#/contest/${(running || upcoming).id}">Open contest</a>
        </div>
      </div>` : ""}

      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-title"><h2>Latest submissions</h2><a href="#/submissions" class="muted">View all →</a></div>
          <div class="table-wrap"><table>
            <thead><tr><th>User</th><th>Problem</th><th>Language</th><th>Verdict</th><th class="num">When</th></tr></thead>
            <tbody>
              ${recent.map((s) => `<tr>
                <td><a href="#/profile/${esc(s.username)}">${esc(s.username)}</a></td>
                <td>${esc(s.problem_title)}</td>
                <td class="mono">${esc(s.language)}</td>
                <td>${verdictBadge(s.verdict, s.status)}</td>
                <td class="num muted">${timeAgo(s.created_at)}</td>
              </tr>`).join("") || `<tr><td colspan="5" class="empty">No submissions yet</td></tr>`}
            </tbody>
          </table></div>
        </div>
        <div class="panel">
          <div class="panel-title"><h2>Top coders</h2><a href="#/leaderboard" class="muted">Full board →</a></div>
          <table>
            <thead><tr><th>#</th><th>User</th><th class="num">Score</th><th class="num">Solved</th></tr></thead>
            <tbody>
              ${leaderboard.slice(0, 8).map((u) => `<tr>
                <td class="rank rank-${u.rank}">${u.rank}</td>
                <td><a href="#/profile/${esc(u.username)}">${esc(u.username)}</a></td>
                <td class="num">${u.points}</td>
                <td class="num">${u.solved}</td>
              </tr>`).join("") || `<tr><td colspan="4" class="empty">Nobody on the board yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function pageProblems() {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    const [{ problems }, { tags }] = await Promise.all([api("/api/problems"), api("/api/problems/tags")]);
    const q = new URLSearchParams((location.hash.split("?")[1] || ""));

    app.innerHTML = `
      <div class="page-head">
        <div><h1>Problems</h1><p>${problems.length} problems — filter by difficulty, tag or name.</p></div>
      </div>
      <div class="filters">
        <input id="f-search" placeholder="Search title, slug or tag…" value="${esc(q.get("search") || "")}" />
        <select id="f-diff">
          <option value="">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
        <select id="f-tag"><option value="">All tags</option>${tags.map((t) => `<option>${esc(t)}</option>`).join("")}</select>
        <span class="muted" id="f-count"></span>
      </div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th style="width:36px"></th><th>Problem</th><th>Difficulty</th><th>Tags</th><th class="num">Solved</th><th class="num">Attempts</th><th class="num">Tests</th><th class="num">TL / ML</th></tr></thead>
        <tbody id="p-rows"></tbody>
      </table></div></div>`;

    const rows = document.getElementById("p-rows");
    const count = document.getElementById("f-count");
    const diffSel = document.getElementById("f-diff");
    if (q.get("difficulty")) diffSel.value = q.get("difficulty");
    const tagSel = document.getElementById("f-tag");
    if (q.get("tag")) tagSel.value = q.get("tag");

    function apply() {
      const s = document.getElementById("f-search").value.toLowerCase().trim();
      const d = diffSel.value, t = tagSel.value;
      const list = problems.filter((p) =>
        (!d || p.difficulty === d) &&
        (!t || p.tags.split(",").map((x) => x.trim()).includes(t)) &&
        (!s || p.title.toLowerCase().includes(s) || p.slug.includes(s) || p.tags.toLowerCase().includes(s)));
      count.textContent = list.length + " shown";
      rows.innerHTML = list.map((p) => `<tr>
        <td>${p.solved_by_me ? '<span class="solved-dot">✓</span>' : (p.attempted_by_me ? '<span class="muted">·</span>' : "")}</td>
        <td><a href="#/problem/${p.id}"><strong>${esc(p.title)}</strong></a>
            <div class="muted" style="font-size:12.5px">/${esc(p.slug)}</div></td>
        <td>${difficultyBadge(p.difficulty)}</td>
        <td class="muted" style="font-size:13px">${esc(p.tags)}</td>
        <td class="num">${p.solved_count}</td>
        <td class="num">${p.attempt_count}</td>
        <td class="num">${p.test_count}</td>
        <td class="num mono" style="font-size:12.5px">${p.time_limit_ms} ms / ${p.memory_limit_mb} MB</td>
      </tr>`).join("") || `<tr><td colspan="8" class="empty">No problems match your filters</td></tr>`;
    }
    ["input", "change"].forEach((ev) => {
      document.getElementById("f-search").addEventListener(ev, apply);
      diffSel.addEventListener(ev, apply);
      tagSel.addEventListener(ev, apply);
    });
    apply();
  }

  const TEMPLATES = {
    python: `a, b = map(int, input().split())\nprint(a + b)\n`,
    cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    long long a, b;\n    cin >> a >> b;\n    cout << a + b << "\\n";\n    return 0;\n}\n`,
    java: `import java.util.*;\nimport java.io.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        long a = sc.nextLong(), b = sc.nextLong();\n        System.out.println(a + b);\n    }\n}\n`,
    javascript: `const input = require("fs").readFileSync(0, "utf8").trim().split(/\\s+/);\nconst a = Number(input[0]), b = Number(input[1]);\nconsole.log(a + b);\n`,
  };

  function buildEditor(problem) {
    const draftKey = (lang) => `ca-draft:${problem.id}:${lang}`;
    const savedLang = localStorage.getItem("ca-lang") || "python";
    const lang = LANGS.some((l) => l.id === savedLang) ? savedLang : "python";
    const value = localStorage.getItem(draftKey(lang)) ?? TEMPLATES[lang] ?? "";

    return `
      <div class="editor" id="editor">
        <div class="editor-bar">
          <select id="ed-lang">${LANGS.map((l) => `<option value="${l.id}" ${l.id === lang ? "selected" : ""}>${esc(l.label)}</option>`).join("")}</select>
          <span class="muted" style="font-size:12.5px">TL ${problem.time_limit_ms} ms · ML ${problem.memory_limit_mb} MB</span>
        </div>
        <div class="editor-body">
          <div class="gutter" id="ed-gutter">1</div>
          <textarea class="code-area" id="ed-code" spellcheck="false" wrap="off">${esc(value)}</textarea>
        </div>
        <div class="editor-actions">
          <button class="btn btn-primary" id="ed-submit">Submit</button>
          <button class="btn" id="ed-run">Run samples</button>
          <span class="editor-hint">Tab inserts indentation · Ctrl+Enter submits</span>
        </div>
      </div>
      <div id="result"></div>`;
  }

  function wireEditor(problem, onRun) {
    const code = document.getElementById("ed-code");
    const gutter = document.getElementById("ed-gutter");
    const langSel = document.getElementById("ed-lang");
    const draftKey = (l) => `ca-draft:${problem.id}:${l}`;
    let currentLang = langSel.value;
    let timer = null;

    const syncGutter = () => {
      const n = code.value.split("\n").length;
      gutter.innerHTML = Array.from({ length: n }, (_, i) => i + 1).join("<br>");
    };
    const save = () => {
      clearTimeout(timer);
      timer = setTimeout(() => localStorage.setItem(draftKey(currentLang), code.value), 350);
    };
    code.addEventListener("input", () => { syncGutter(); save(); });
    code.addEventListener("scroll", () => { gutter.scrollTop = code.scrollTop; });
    code.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = code.selectionStart, en = code.selectionEnd;
        code.value = code.value.slice(0, s) + "    " + code.value.slice(en);
        code.selectionStart = code.selectionEnd = s + 4;
        syncGutter(); save();
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById("ed-submit").click();
      }
    });
    langSel.addEventListener("change", () => {
      localStorage.setItem(draftKey(currentLang), code.value);
      currentLang = langSel.value;
      localStorage.setItem("ca-lang", currentLang);
      code.value = localStorage.getItem(draftKey(currentLang)) ?? TEMPLATES[currentLang] ?? "";
      syncGutter();
    });
    syncGutter();

    const showResult = (sub) => {
      const box = document.getElementById("result");
      if (!sub) { box.innerHTML = ""; return; }
      const pending = sub.status !== "judged";
      box.innerHTML = `
        <div class="result-card">
          <div class="result-head">
            <div>${verdictBadge(sub.verdict, sub.status)} ${pending ? '<span class="spinner"></span>' : ""}</div>
            <div class="result-meta">
              <span>${esc(sub.language)}</span>
              ${sub.status === "judged" ? `
                <span>⚡ ${sub.time_ms ?? 0} ms</span>
                <span>mem ${memStr(sub.memory_kb)}</span>
                <span>tests ${sub.tests_passed}/${sub.tests_total}</span>` : `<span>judging…</span>`}
              <a href="#/submission/${sub.id}">details</a>
            </div>
          </div>
          ${sub.status === "judged" && sub.message ? `<pre class="msg-block">${esc(sub.message)}</pre>` : ""}
        </div>`;
    };

    const start = async (mode) => {
      if (!ME) { location.hash = "#/login"; toast("Log in to submit code"); return; }
      const source = code.value;
      const language = langSel.value;
      const btn = document.getElementById(mode === "sample" ? "ed-run" : "ed-submit");
      btn.disabled = true;
      try {
        let contest_id = null;
        if (mode === "submit") {
          try {
            const { contests } = await api("/api/contests");
            const c = contests.find((x) => x.status === "running" && x.registered && (x.problems || []).some((pp) => pp.id === problem.id));
            if (c) contest_id = c.id;
          } catch {}
        }
        const { id } = await api("/api/submissions", { method: "POST", body: { problem_id: problem.id, language, source, mode, contest_id } });
        showResult({ id, language, status: "queued" });
        const t = setInterval(async () => {
          try {
            const { submission } = await api(`/api/submissions/${id}`);
            showResult(submission);
            if (submission.status === "judged") {
              clearInterval(t);
              btn.disabled = false;
              if (mode !== "sample") loadMySubmissions();
              else toast(submission.verdict === "AC" ? "Sample tests passed" : `Samples: ${VERDICTS[submission.verdict]}`, submission.verdict === "AC" ? "ok" : "err");
            }
          } catch (e) { clearInterval(t); btn.disabled = false; fail(e); }
        }, 700);
        pollers.push(t);
      } catch (e) {
        btn.disabled = false;
        fail(e);
      }
    };
    document.getElementById("ed-submit").onclick = () => start("submit");
    document.getElementById("ed-run").onclick = () => start("sample");
  }

  async function loadMySubmissions(problemId, targetId) {
    const box = document.getElementById(targetId);
    if (!box) return;
    if (!ME) { box.innerHTML = `<div class="empty">Log in to see your submissions.</div>`; return; }
    try {
      const { submissions } = await api(`/api/submissions?mine=1&problem_id=${problemId}&limit=10`);
      box.innerHTML = submissions.map((s) => `<tr>
        <td><a href="#/submission/${s.id}">#${s.id}</a></td>
        <td>${verdictBadge(s.verdict, s.status)}</td>
        <td class="mono" style="font-size:12.5px">${esc(s.language)}</td>
        <td class="num muted">${timeAgo(s.created_at)}</td>
      </tr>`).join("") || `<tr><td colspan="4" class="empty">No submissions yet</td></tr>`;
    } catch (e) { box.innerHTML = `<tr><td colspan="4" class="empty">${esc(e.message)}</td></tr>`; }
  }

  async function pageProblem(id) {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    let data;
    try { data = await api(`/api/problems/${id}`); }
    catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)} <br><br><a href="#/problems">← Back to problems</a></div>`; return; }
    const p = data.problem;
    const samples = data.tests.filter((t) => t.is_sample);

    app.innerHTML = `
      <div class="page-head">
        <div>
          <h1>${esc(p.title)} ${difficultyBadge(p.difficulty)}</h1>
          <p class="muted">/${esc(p.slug)} · ${p.solved_count} solved · ${esc(p.tags)}</p>
        </div>
        <div class="limits">
          <span>⏱ <b>${p.time_limit_ms} ms</b> time</span>
          <span>💾 <b>${p.memory_limit_mb} MB</b> memory</span>
          <span>🧪 <b>${p.test_count}</b> tests</span>
        </div>
      </div>

      <div class="problem-layout">
        <div>
          <div class="panel statement">
            ${md(p.statement)}
            ${p.constraints ? `<h2>Constraints</h2>${md(p.constraints)}` : ""}
            ${samples.length ? `<h2>Examples</h2>` : ""}
            ${samples.map((t, i) => `
              <div class="muted" style="margin-top:8px">Sample ${i + 1}</div>
              <div class="sample">
                <div class="sample-row"><div class="sample-key">Input</div><div class="sample-val">${esc(t.input)}</div></div>
                <div class="sample-row"><div class="sample-key">Output</div><div class="sample-val">${esc(t.expected_output)}</div></div>
              </div>`).join("")}
          </div>
          <div class="panel" style="margin-top:18px">
            <div class="panel-title"><h3>Your submissions</h3><span class="pill-count">${ME ? "" : "log in required"}</span></div>
            <div class="table-wrap"><table>
              <thead><tr><th>ID</th><th>Verdict</th><th>Lang</th><th class="num">When</th></tr></thead>
              <tbody id="my-subs"></tbody>
            </table></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title"><h3>Submit your solution</h3></div>
          ${buildEditor(p)}
        </div>
      </div>`;

    wireEditor(p);
    loadMySubmissions(p.id, "my-subs");
    every(3000, () => loadMySubmissions(p.id, "my-subs"));
    if (ME) {
      api("/api/contests").then(({ contests }) => {
        const c = contests.find((x) => x.status === "running" && x.registered && (x.problems || []).some((pp) => pp.id === p.id));
        if (c) {
          const note = document.createElement("div");
          note.className = "section-note";
          note.style.marginTop = "10px";
          note.innerHTML = `Submissions from this page count toward <a href="#/contest/${c.id}">${esc(c.title)}</a> standings.`;
          document.querySelector(".editor").before(note);
        }
      }).catch(() => {});
    }
  }

  async function pageSubmissions() {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    const q = new URLSearchParams((location.hash.split("?")[1] || ""));
    const meParam = q.get("mine") === "1" || (!q.get("user") && !q.get("problem_id"));
    const [{ languages }] = await Promise.all([api("/api/submissions/languages")]);
    LANGS = languages;

    app.innerHTML = `
      <div class="page-head"><div><h1>Submissions</h1><p>Live feed of every judged submission.</p></div></div>
      <div class="filters">
        <label style="margin:0"><input type="checkbox" id="s-mine" ${meParam ? "checked" : ""} style="width:auto"> only mine</label>
        <select id="s-verdict"><option value="">Any verdict</option>${Object.entries(VERDICTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
        <input id="s-user" placeholder="username…" value="${esc(q.get("user") || "")}" />
        <button class="btn btn-sm" id="s-refresh">Refresh</button>
      </div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>User</th><th>Problem</th><th>Lang</th><th>Verdict</th><th class="num">Time</th><th class="num">Memory</th><th class="num">When</th></tr></thead>
        <tbody id="s-rows"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
      </table></div></div>`;

    const load = async () => {
      const mine = document.getElementById("s-mine").checked;
      const v = document.getElementById("s-verdict").value;
      const u = document.getElementById("s-user").value.trim();
      const params = new URLSearchParams({ limit: "50" });
      if (mine && ME) params.set("mine", "1");
      if (u) { params.delete("mine"); params.set("user", u); }
      if (v) params.set("verdict", v);
      try {
        const { submissions } = await api("/api/submissions?" + params);
        document.getElementById("s-rows").innerHTML = submissions.map((s) => `<tr>
          <td><a href="#/submission/${s.id}" class="mono">#${s.id}</a></td>
          <td><a href="#/profile/${esc(s.username)}">${esc(s.username)}</a></td>
          <td><a href="#/problem/${s.problem_id}">${esc(s.problem_title)}</a></td>
          <td class="mono" style="font-size:12.5px">${esc(s.language)}</td>
          <td>${verdictBadge(s.verdict, s.status)}</td>
          <td class="num mono">${s.time_ms ?? "—"}${s.time_ms != null ? " ms" : ""}</td>
          <td class="num mono">${memStr(s.memory_kb)}</td>
          <td class="num muted">${timeAgo(s.created_at)}</td>
        </tr>`).join("") || `<tr><td colspan="8" class="empty">No submissions</td></tr>`;
      } catch (e) { fail(e); }
    };
    ["change"].forEach((ev) => {
      document.getElementById("s-mine").addEventListener(ev, load);
      document.getElementById("s-verdict").addEventListener(ev, load);
    });
    document.getElementById("s-user").addEventListener("keydown", (e) => { if (e.key === "Enter") load(); });
    document.getElementById("s-refresh").onclick = load;
    await load();
    every(4000, load);
  }

  async function pageSubmission(id) {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    let sub;
    try { sub = (await api(`/api/submissions/${id}`)).submission; }
    catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}<br><br><a href="#/submissions">← Back</a></div>`; return; }

    const render = () => {
      const judged = sub.status === "judged";
      app.innerHTML = `
        <div class="page-head">
          <div>
            <h1>Submission #${sub.id}</h1>
            <p><a href="#/profile/${esc(sub.username)}">${esc(sub.username)}</a> →
               <a href="#/problem/${sub.problem_id}">${esc(sub.problem_title)}</a> · ${fmtDate(sub.created_at)}</p>
          </div>
          ${verdictBadge(sub.verdict, sub.status)} ${judged ? "" : '<span class="spinner"></span>'}
        </div>

        <div class="grid grid-2">
          <div class="panel">
            <div class="panel-title"><h3>Source code</h3><span class="pill-count">${esc(sub.language)}</span></div>
            ${sub.source != null
              ? `<pre class="msg-block neutral" style="border-radius:8px;border:1px solid var(--border)">${esc(sub.source)}</pre>`
              : `<div class="empty">Source is only visible to its author and admins.</div>`}
          </div>
          <div>
            <div class="panel">
              <div class="panel-title"><h3>Result</h3></div>
              <div class="result-meta" style="flex-direction:column;gap:8px">
                <div>Verdict: <strong>${esc(sub.verdict_label)}</strong></div>
                <div>Time: <strong>${sub.time_ms != null ? sub.time_ms + " ms" : "—"}</strong> <span class="muted">(limit ${sub.time_limit_ms} ms)</span></div>
                <div>Memory: <strong>${memStr(sub.memory_kb)}</strong> <span class="muted">(limit ${sub.memory_limit_mb} MB)</span></div>
                <div>Tests: <strong>${sub.tests_passed}/${sub.tests_total}</strong></div>
                <div>Status: <strong>${esc(sub.status)}</strong></div>
              </div>
              ${sub.message ? `<pre class="msg-block" style="border-radius:8px;margin-top:12px">${esc(sub.message)}</pre>` : ""}
            </div>
            ${sub.tests && sub.tests.length ? `
            <div class="panel" style="margin-top:18px">
              <div class="panel-title"><h3>Test cases</h3></div>
              <div class="test-list" style="padding:0">
                ${sub.tests.map((t) => `<span class="test-chip ${t.verdict === "AC" ? "ok" : "bad"}" title="${esc(VERDICTS[t.verdict] || t.verdict)} — ${t.time_ms ?? 0} ms / ${memStr(t.memory_kb)}">#${t.position} ${esc(t.verdict)}</span>`).join("")}
              </div>
              ${sub.tests.filter((t) => t.message).map((t) => `<pre class="msg-block">test #${t.position}: ${esc(t.message)}</pre>`).join("")}
            </div>` : ""}
          </div>
        </div>`;
    };
    render();
    if (sub.status !== "judged") {
      const t = setInterval(async () => {
        try {
          sub = (await api(`/api/submissions/${id}`)).submission;
          render();
          if (sub.status === "judged") clearInterval(t);
        } catch { clearInterval(t); }
      }, 900);
      pollers.push(t);
    }
  }

  async function pageLeaderboard() {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    const { leaderboard } = await api("/api/leaderboard?limit=100");
    app.innerHTML = `
      <div class="page-head">
        <div><h1>Leaderboard</h1><p>Ranked by score (easy 100 · medium 200 · hard 300), then solved count, then fewer attempts.</p></div>
      </div>
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>Rank</th><th>Coder</th><th>Role</th><th class="num">Score</th><th class="num">Solved</th><th class="num">Submissions</th></tr></thead>
        <tbody>
          ${leaderboard.map((u) => `<tr class="${ME && u.username === ME.username ? "me-row" : ""}">
            <td class="rank rank-${u.rank}">#${u.rank}</td>
            <td><a href="#/profile/${esc(u.username)}">${esc(u.username)}</a></td>
            <td>${u.role === "admin" ? '<span class="badge badge-admin">admin</span>' : '<span class="badge badge-user">coder</span>'}</td>
            <td class="num"><strong>${u.points}</strong></td>
            <td class="num">${u.solved}</td>
            <td class="num">${u.attempts}</td>
          </tr>`).join("") || `<tr><td colspan="6" class="empty">No data yet</td></tr>`}
        </tbody>
      </table></div></div>`;
  }

  async function pageContests() {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    const { contests } = await api("/api/contests");
    app.innerHTML = `
      <div class="page-head"><div><h1>Contests</h1><p>Create an account and register to compete. Standings use penalty time (20 min per wrong attempt).</p></div></div>
      <div class="grid" style="gap:14px">
        ${contests.map((c) => `
          <div class="panel">
            <div class="contest-card">
              <div>
                <span class="status-pill status-${c.status}">${c.status}</span>
                <a href="#/contest/${c.id}" style="margin-left:10px;font-size:17px;font-weight:700;color:var(--text)">${esc(c.title)}</a>
                <div class="muted" style="font-size:13.5px;margin-top:4px">${esc(c.description)}</div>
                <div class="muted" style="font-size:13px;margin-top:6px">
                  ${fmtDate(c.starts_at)} → ${fmtDate(c.ends_at)} ·
                  ${c.problems.length} problems · ${c.participant_count} participants
                  ${c.registered ? ' · <span class="solved-dot">registered</span>' : ""}
                </div>
              </div>
              <a class="btn ${c.status === "running" ? "btn-primary" : ""}" href="#/contest/${c.id}">Open</a>
            </div>
          </div>`).join("") || `<div class="panel empty">No contests yet.</div>`}
      </div>`;
  }

  async function pageContest(id) {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    let c;
    try { c = (await api(`/api/contests/${id}`)).contest; }
    catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }

    const draw = (tab) => {
      const head = `
        <div class="page-head">
          <div>
            <h1>${esc(c.title)}</h1>
            <p>${esc(c.description)}</p>
          </div>
          <div style="text-align:right">
            <span class="status-pill status-${c.status}">${c.status}</span>
            <div class="countdown" id="cd" style="font-size:20px;margin-top:6px"></div>
            <div class="muted" style="font-size:12.5px">${fmtDate(c.starts_at)} → ${fmtDate(c.ends_at)}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
          ${c.status !== "ended" ? (c.registered
            ? (c.status === "upcoming" ? `<button class="btn btn-danger btn-sm" id="c-unregister">Unregister</button>` : "")
            : `<button class="btn btn-primary btn-sm" id="c-register">Register</button>`) : ""}
          <span class="muted" style="align-self:center">${c.participant_count} participants · ${c.problems.length} problems</span>
        </div>
        <div class="tabs">
          <button class="tab ${tab === "problems" ? "active" : ""}" data-tab="problems">Problems</button>
          <button class="tab ${tab === "standings" ? "active" : ""}" data-tab="standings">Standings</button>
        </div>
        <div id="tab-body"></div>`;

      app.innerHTML = head;

      const tick = () => {
        const target = c.status === "upcoming" ? c.starts_at : c.ends_at;
        const el = document.getElementById("cd");
        if (el) el.textContent = (c.status === "upcoming" ? "starts in " : c.status === "running" ? "ends in " : "ended ") + fmtLeft(target - Date.now());
      };
      tick();
      const iv = setInterval(tick, 1000);
      pollers.push(iv);

      const reg = document.getElementById("c-register");
      if (reg) reg.onclick = async () => {
        try { await api(`/api/contests/${c.id}/register`, { method: "POST" }); toast("Registered", "ok"); c.registered = true; c.participant_count++; draw(tab); }
        catch (e) { fail(e); }
      };
      const unreg = document.getElementById("c-unregister");
      if (unreg) unreg.onclick = async () => {
        try { await api(`/api/contests/${c.id}/register`, { method: "DELETE" }); toast("Unregistered", "ok"); c.registered = false; c.participant_count--; draw(tab); }
        catch (e) { fail(e); }
      };
      app.querySelectorAll(".tab").forEach((b) => (b.onclick = () => draw(b.dataset.tab)));

      const body = document.getElementById("tab-body");
      if (tab === "problems") {
        const started = c.status !== "upcoming";
        body.innerHTML = c.problems.length ? `<div class="panel"><div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Problem</th><th>Difficulty</th><th class="num">Score</th><th class="num">TL</th></tr></thead>
          <tbody>${c.problems.map((p, i) => `<tr>
            <td class="mono">${String.fromCharCode(65 + i)}</td>
            <td>${p.slug ? `<a href="#/problem/${p.id}"><strong>${esc(p.title)}</strong></a>` : `<span class="muted">${esc(p.title)}</span>`}</td>
            <td>${difficultyBadge(p.difficulty)}</td>
            <td class="num">${p.score}</td>
            <td class="num mono">${p.time_limit_ms} ms</td>
          </tr>`).join("")}</tbody>
        </table></div>${started ? "" : '<div class="empty">Problems unlock when the contest starts.</div>'}</div>` : `<div class="panel empty">No problems in this contest yet.</div>`;
        if (started && ME && c.registered && c.can_submit) {
          const note = document.createElement("div");
          note.className = "section-note";
          note.textContent = "Open a problem to solve it — submissions made from its page count toward this contest's standings.";
          body.prepend(note);
        }
      } else {
        body.innerHTML = `<div class="panel" id="standings"><div class="empty">Loading standings…</div></div>`;
        api(`/api/contests/${c.id}/standings`).then(({ standings }) => {
          const el = document.getElementById("standings");
          if (!el) return;
          if (!standings.length) { el.innerHTML = `<div class="empty">No participants yet.</div>`; return; }
          const cols = Math.max(...standings.map((s) => s.cells.length), 1);
          el.innerHTML = `<div class="table-wrap"><table>
            <thead><tr><th>Rank</th><th>Coder</th><th class="num">Solved</th><th class="num">Penalty</th>
              ${Array.from({ length: cols }, (_, i) => `<th class="num">${String.fromCharCode(65 + i)}</th>`).join("")}</tr></thead>
            <tbody>${standings.map((s) => `<tr class="${ME && s.username === ME.username ? "me-row" : ""}">
              <td class="rank rank-${s.rank}">#${s.rank}</td>
              <td><a href="#/profile/${esc(s.username)}">${esc(s.username)}</a></td>
              <td class="num">${s.solved}</td>
              <td class="num">${s.penalty}</td>
              ${s.cells.map((cell) => `<td class="num mono">${cell.solved ? `<span class="solved-dot">+${cell.attempts > 1 ? cell.attempts : ""}</span>` : cell.attempts ? `<span class="v-WA verdict">-${cell.attempts}</span>` : `<span class="muted">·</span>`}</td>`).join("")}
            </tr>`).join("")}</tbody>
          </table></div>`;
        }).catch((e) => { const el = document.getElementById("standings"); if (el) el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; });
      }
    };
    draw("problems");
  }

  async function pageLogin(isRegister) {
    app.innerHTML = `
      <div class="panel auth-card">
        <h1>${isRegister ? "Create account" : "Welcome back"}</h1>
        <p class="muted">${isRegister ? "Join CodeArena to submit code and compete." : "Log in to continue."}</p>
        <label>Username</label>
        <input id="a-user" autocomplete="username" ${isRegister ? 'placeholder="3-24 chars: a-z 0-9 _"' : ""} />
        <label>Password</label>
        <input id="a-pass" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" />
        ${isRegister ? "<label>Confirm password</label><input id='a-pass2' type='password' autocomplete='new-password' />" : ""}
        <button class="btn btn-primary" id="a-go">${isRegister ? "Sign up" : "Log in"}</button>
        <div class="auth-switch">
          ${isRegister ? 'Already registered? <a href="#/login">Log in</a>' : 'No account? <a href="#/register">Sign up</a>'}
        </div>
      </div>`;
    const go = async () => {
      const username = document.getElementById("a-user").value.trim();
      const password = document.getElementById("a-pass").value;
      if (isRegister && password !== document.getElementById("a-pass2").value) return toast("Passwords do not match");
      try {
        const { user } = await api(`/api/auth/${isRegister ? "register" : "login"}`, { method: "POST", body: { username, password } });
        ME = user;
        renderAuthArea();
        toast(isRegister ? "Welcome to CodeArena!" : `Welcome back, ${user.username}`, "ok");
        location.hash = "#/problems";
      } catch (e) { fail(e); }
    };
    document.getElementById("a-go").onclick = go;
    app.querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); }));
  }

  async function pageProfile(username) {
    app.innerHTML = `<div class="loading-screen">Loading…</div>`;
    let d;
    try { d = await api(`/api/profile/${encodeURIComponent(username)}`); }
    catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
    app.innerHTML = `
      <div class="page-head">
        <div style="display:flex;gap:14px;align-items:center">
          <span class="avatar" style="width:52px;height:52px;font-size:19px">${esc(initials(d.user.username))}</span>
          <div>
            <h1 style="margin:0">${esc(d.user.username)} ${d.user.role === "admin" ? '<span class="badge badge-admin">admin</span>' : ""}</h1>
            <p class="muted">joined ${fmtDate(d.user.created_at)}</p>
          </div>
        </div>
      </div>
      <div class="stat-cards">
        <div class="stat-card"><div class="num">${d.stats.solved}</div><div class="lbl">Solved</div></div>
        <div class="stat-card"><div class="num">${d.stats.accepted}</div><div class="lbl">Accepted</div></div>
        <div class="stat-card"><div class="num">${d.stats.total}</div><div class="lbl">Submissions</div></div>
        <div class="stat-card"><div class="num">${d.stats.total ? Math.round((d.stats.accepted / d.stats.total) * 100) : 0}%</div><div class="lbl">Acceptance</div></div>
      </div>
      <div class="panel">
        <div class="panel-title"><h3>Solved problems</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Problem</th><th>Difficulty</th><th class="num">Solved at</th></tr></thead>
          <tbody>${d.solved.map((p) => `<tr>
            <td><a href="#/problem/${p.id}"><strong>${esc(p.title)}</strong></a></td>
            <td>${difficultyBadge(p.difficulty)}</td>
            <td class="num muted">${fmtDate(p.solved_at)}</td>
          </tr>`).join("") || `<tr><td colspan="3" class="empty">Nothing solved yet.</td></tr>`}</tbody>
        </table></div>
      </div>`;
  }

  /* ---------------- router ---------------- */
  const setNav = (name) => {
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
  };

  let routeSeq = 0;
  let inflight = null;

  async function route() {
    const raw = (location.hash || "#/").slice(1);
    if (inflight === raw) return;
    inflight = raw;
    const seq = ++routeSeq;
    stopPollers();
    const path = raw.split("?")[0];
    const seg = path.split("/").filter(Boolean);
    try {
      if (!seg.length) { setNav(""); return await pageHome(); }
      switch (seg[0]) {
        case "problems": setNav("problems"); return await pageProblems();
        case "problem": setNav("problems"); return await pageProblem(seg[1]);
        case "submissions": setNav("submissions"); return await pageSubmissions();
        case "submission": setNav("submissions"); return await pageSubmission(seg[1]);
        case "leaderboard": setNav("leaderboard"); return await pageLeaderboard();
        case "contests": setNav("contests"); return await pageContests();
        case "contest": setNav("contests"); return await pageContest(seg[1]);
        case "profile": setNav(""); return await pageProfile(seg[1]);
        case "login": setNav(""); return await pageLogin(false);
        case "register": setNav(""); return await pageLogin(true);
        case "admin": {
          setNav("admin");
          if (!ME) { location.hash = "#/login"; return; }
          if (ME.role !== "admin") { app.innerHTML = `<div class="empty">Admin access required.</div>`; return; }
          return await window.AdminPages.page(seg);
        }
        default: app.innerHTML = `<div class="empty">Page not found. <a href="#/">Go home</a></div>`;
      }
    } catch (e) {
      app.innerHTML = `<div class="empty">${esc(e.message || e)}<br><br><a href="#/">Home</a></div>`;
    } finally {
      if (seq === routeSeq) inflight = null;
    }
  }

  window.CA = { api, esc, md, toast, fail, verdictBadge, difficultyBadge, timeAgo, fmtDate, memStr, VERDICTS, setNav, get me() { return ME; }, get langs() { return LANGS; }, stopPollers, pollers };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const [me, langs] = await Promise.all([api("/api/auth/me"), api("/api/submissions/languages")]);
      ME = me.user;
      LANGS = langs.languages;
    } catch {}
    renderAuthArea();
    if (!location.hash) location.hash = "#/";
    route();
    window.addEventListener("hashchange", () => { stopPollers(); route(); });
  });
})();
