/* CodeArena admin dashboard */
(() => {
  "use strict";
  const { api, esc, toast, fail, verdictBadge, difficultyBadge, timeAgo, fmtDate, memStr, VERDICTS } = window.CA;
  const app = document.getElementById("app");

  let editing = null; // problem being edited (null = new)
  let selectedProblemId = null;
  let testCache = [];

  const TABS = [
    ["", "Overview"],
    ["problems", "Problems & tests"],
    ["contests", "Contests"],
    ["users", "Users"],
    ["submissions", "Submissions"],
  ];

  function shell(active, body) {
    app.innerHTML = `
      <div class="page-head">
        <div><h1>Admin dashboard</h1><p>Platform statistics and management.</p></div>
      </div>
      <div class="tabs">
        ${TABS.map(([k, label]) => `<button class="tab ${active === k ? "active" : ""}" data-go="#/admin${k ? "/" + k : ""}">${label}</button>`).join("")}
      </div>
      <div id="admin-body">${body || '<div class="loading-screen">Loading…</div>'}</div>`;
    app.querySelectorAll(".tab").forEach((b) => (b.onclick = () => (location.hash = b.dataset.go)));
  }

  /* ---------------- overview ---------------- */
  async function overview() {
    shell("", "");
    const s = await api("/api/admin/stats");
    const maxVerdict = Math.max(...s.verdicts.map((v) => v.count), 1);
    const maxDay = Math.max(...s.recentDays.map((d) => d.count), 1);
    document.getElementById("admin-body").innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="num">${s.totals.users}</div><div class="lbl">Users</div></div>
        <div class="stat-card"><div class="num">${s.totals.problems}</div><div class="lbl">Problems</div></div>
        <div class="stat-card"><div class="num">${s.totals.tests}</div><div class="lbl">Test cases</div></div>
        <div class="stat-card"><div class="num">${s.totals.submissions}</div><div class="lbl">Submissions</div></div>
      </div>
      <div class="stat-cards">
        <div class="stat-card"><div class="num">${s.totals.accepted}</div><div class="lbl">Accepted</div></div>
        <div class="stat-card"><div class="num">${s.totals.pending}</div><div class="lbl">In queue</div></div>
        <div class="stat-card"><div class="num">${s.queue}</div><div class="lbl">Judge queue</div></div>
        <div class="stat-card"><div class="num">${s.totals.contests}</div><div class="lbl">Contests</div></div>
      </div>

      <div class="grid grid-2" style="margin-top:4px">
        <div class="panel">
          <div class="panel-title"><h3>Verdict distribution</h3></div>
          ${s.verdicts.map((v) => `
            <div class="bar-row">
              <span>${verdictBadge(v.verdict)}</span>
              <div class="bar-track"><div class="bar-fill ${v.verdict === "AC" ? "" : "bad"}" style="width:${Math.round((v.count / maxVerdict) * 100)}%"></div></div>
              <span class="num mono">${v.count}</span>
            </div>`).join("") || `<div class="empty">No judged submissions</div>`}
        </div>
        <div class="panel">
          <div class="panel-title"><h3>Submissions — last 14 days</h3></div>
          <div style="display:flex;align-items:flex-end;gap:4px;height:150px">
            ${s.recentDays.map((d) => `
              <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:100%">
                <div title="${d.date}: ${d.count}" style="width:100%;background:linear-gradient(180deg,var(--accent),var(--accent-2));border-radius:4px 4px 0 0;height:${Math.max(3, Math.round((d.count / maxDay) * 100))}px"></div>
                <span style="font-size:9.5px;color:var(--muted)">${d.date.slice(5)}</span>
              </div>`).join("")}
          </div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:18px">
        <div class="panel">
          <div class="panel-title"><h3>Most submitted problems</h3></div>
          <table><thead><tr><th>Problem</th><th class="num">Subs</th><th class="num">AC</th><th class="num">Rate</th></tr></thead>
          <tbody>${s.topProblems.map((p) => `<tr>
            <td><a href="#/problem/${p.id}">${esc(p.title)}</a></td>
            <td class="num">${p.submissions}</td>
            <td class="num">${p.accepted || 0}</td>
            <td class="num">${p.submissions ? Math.round(((p.accepted || 0) / p.submissions) * 100) : 0}%</td>
          </tr>`).join("") || `<tr><td colspan="4" class="empty">No data</td></tr>`}</tbody></table>
        </div>
        <div class="panel">
          <div class="panel-title"><h3>Most active users</h3></div>
          <table><thead><tr><th>User</th><th class="num">Subs</th><th class="num">AC</th></tr></thead>
          <tbody>${s.topUsers.map((u) => `<tr>
            <td><a href="#/profile/${esc(u.username)}">${esc(u.username)}</a></td>
            <td class="num">${u.submissions}</td>
            <td class="num">${u.accepted || 0}</td>
          </tr>`).join("") || `<tr><td colspan="3" class="empty">No data</td></tr>`}</tbody></table>
        </div>
      </div>

      <div class="panel" style="margin-top:18px">
        <div class="panel-title"><h3>Recent submissions</h3><a href="#/admin/submissions" class="muted">manage →</a></div>
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>User</th><th>Problem</th><th>Lang</th><th>Verdict</th><th class="num">When</th></tr></thead>
          <tbody>${s.recent.map((r) => `<tr>
            <td><a href="#/submission/${r.id}">#${r.id}</a></td>
            <td>${esc(r.username)}</td><td>${esc(r.problem_title)}</td>
            <td class="mono" style="font-size:12.5px">${esc(r.language)}</td>
            <td>${verdictBadge(r.verdict, r.status)}</td>
            <td class="num muted">${timeAgo(r.created_at)}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>`;
  }

  /* ---------------- users ---------------- */
  async function users() {
    shell("users", "");
    const { users } = await api("/api/admin/users");
    document.getElementById("admin-body").innerHTML = `
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>User</th><th>Role</th><th>Status</th><th class="num">Solved</th><th class="num">Subs</th><th>Joined</th><th></th></tr></thead>
        <tbody>${users.map((u) => `<tr id="u-${u.id}">
          <td><a href="#/profile/${esc(u.username)}">${esc(u.username)}</a></td>
          <td>
            <select data-user="${u.id}" class="role-sel" style="width:auto;padding:4px 8px">
              <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
              <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
            </select>
          </td>
          <td>${u.banned ? '<span class="badge badge-banned">banned</span>' : '<span class="badge badge-user">active</span>'}</td>
          <td class="num">${u.solved}</td>
          <td class="num">${u.submissions}</td>
          <td class="muted">${fmtDate(u.created_at)}</td>
          <td><button class="btn btn-sm ${u.banned ? "" : "btn-danger"}" data-ban="${u.id}" data-val="${u.banned ? 0 : 1}">${u.banned ? "Unban" : "Ban"}</button></td>
        </tr>`).join("")}</tbody>
      </table></div></div>`;

    document.querySelectorAll(".role-sel").forEach((sel) => (sel.onchange = async () => {
      try {
        await api(`/api/admin/users/${sel.dataset.user}`, { method: "PUT", body: { role: sel.value } });
        toast("Role updated", "ok");
      } catch (e) { fail(e); }
    }));
    document.querySelectorAll("[data-ban]").forEach((b) => (b.onclick = async () => {
      try {
        await api(`/api/admin/users/${b.dataset.ban}`, { method: "PUT", body: { banned: b.dataset.val === "1" } });
        toast("User updated", "ok");
        users();
      } catch (e) { fail(e); }
    }));
  }

  /* ---------------- problems & tests ---------------- */
  function problemForm(p) {
    const v = p || {};
    return `
      <form id="p-form" class="panel">
        <div class="panel-title"><h3>${p ? "Edit problem" : "New problem"}</h3>
          ${p ? `<a class="btn btn-sm" href="#/problem/${p.id}" target="_blank">view</a>` : ""}</div>
        <div class="form-row">
          <div><label>Title *</label><input id="pf-title" required value="${esc(v.title || "")}" /></div>
          <div><label>Slug</label><input id="pf-slug" placeholder="auto from title" value="${esc(v.slug || "")}" /></div>
        </div>
        <div class="form-row">
          <div><label>Difficulty</label>
            <select id="pf-diff">
              ${["easy", "medium", "hard"].map((d) => `<option ${v.difficulty === d ? "selected" : ""}>${d}</option>`).join("")}
            </select></div>
          <div><label>Tags (comma separated)</label><input id="pf-tags" value="${esc(v.tags || "")}" /></div>
          <div><label>Visibility</label>
            <select id="pf-vis"><option value="public" ${v.visibility !== "private" ? "selected" : ""}>public</option>
            <option value="private" ${v.visibility === "private" ? "selected" : ""}>private</option></select></div>
        </div>
        <div class="form-row">
          <div><label>Time limit (ms)</label><input id="pf-tl" type="number" min="100" max="10000" value="${v.time_limit_ms || 1000}" /></div>
          <div><label>Memory limit (MB)</label><input id="pf-ml" type="number" min="16" max="1024" value="${v.memory_limit_mb || 256}" /></div>
        </div>
        <label>Statement (markdown)</label>
        <textarea id="pf-stmt" rows="10" style="font-family:var(--mono);font-size:13px">${esc(v.statement || "")}</textarea>
        <label>Input format</label><textarea id="pf-in" rows="2">${esc(v.input_spec || "")}</textarea>
        <label>Output format</label><textarea id="pf-out" rows="2">${esc(v.output_spec || "")}</textarea>
        <label>Constraints (markdown)</label><textarea id="pf-cons" rows="3">${esc(v.constraints || "")}</textarea>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-primary" type="submit">${p ? "Save changes" : "Create problem"}</button>
          <button class="btn" type="button" id="pf-cancel">Clear</button>
          ${p ? `<button class="btn btn-danger" type="button" id="pf-delete">Delete</button>` : ""}
        </div>
      </form>`;
  }

  async function loadTests(problemId) {
    const box = document.getElementById("tests-box");
    if (!box) return;
    if (!problemId) { box.innerHTML = `<div class="empty">Select or create a problem to manage its test cases.</div>`; return; }
    const { tests } = await api(`/api/problems/${problemId}/tests`);
    testCache = tests;
    renderTests(problemId);
  }

  function renderTests(problemId) {
    const box = document.getElementById("tests-box");
    if (!box) return;
    box.innerHTML = `
      <div class="panel-title"><h3>Test cases <span class="pill-count">${testCache.length}</span></h3>
        <button class="btn btn-sm" id="add-test">+ Add test</button></div>
      <div class="section-note">Sample tests are shown to users on the problem page. Hidden tests run during judging but their contents are never revealed.</div>
      <div id="test-list">
        ${testCache.map((t, i) => `
          <div class="test-card" data-id="${t.id}">
            <div class="test-card-head">
              <strong>#${t.position}</strong>
              <div style="display:flex;gap:8px;align-items:center">
                <label style="margin:0;font-size:12.5px;display:flex;gap:5px;align-items:center">
                  <input type="checkbox" class="t-sample" ${t.is_sample ? "checked" : ""} style="width:auto"> sample</label>
                <button class="btn btn-sm t-save">Save</button>
                <button class="btn btn-sm btn-danger t-del">Delete</button>
              </div>
            </div>
            <label>Input</label><textarea class="t-in">${esc(t.input)}</textarea>
            <label>Expected output</label><textarea class="t-out">${esc(t.expected_output)}</textarea>
          </div>`).join("")}
      </div>`;

    document.getElementById("add-test").onclick = async () => {
      try {
        await api(`/api/problems/${problemId}/tests`, { method: "POST", body: { input: "", expected_output: "", is_sample: true } });
        loadTests(problemId);
      } catch (e) { fail(e); }
    };
    box.querySelectorAll(".test-card").forEach((card) => {
      const id = card.dataset.id;
      card.querySelector(".t-save").onclick = async () => {
        try {
          await api(`/api/problems/${problemId}/tests/${id}`, {
            method: "PUT",
            body: {
              input: card.querySelector(".t-in").value,
              expected_output: card.querySelector(".t-out").value,
              is_sample: card.querySelector(".t-sample").checked,
            },
          });
          toast("Test saved", "ok");
          loadTests(problemId);
        } catch (e) { fail(e); }
      };
      card.querySelector(".t-del").onclick = async () => {
        if (!confirm("Delete this test case?")) return;
        try { await api(`/api/problems/${problemId}/tests/${id}`, { method: "DELETE" }); loadTests(problemId); }
        catch (e) { fail(e); }
      };
    });
  }

  async function problemsTab() {
    shell("problems", "");
    const [{ problems }] = await Promise.all([api("/api/problems")]);
    const adminProblems = problems;
    const first = adminProblems[0] || null;
    if (editing) {
      selectedProblemId = editing.id;
    } else if (first && (!selectedProblemId || !adminProblems.some((p) => p.id === selectedProblemId))) {
      selectedProblemId = first.id;
      editing = (await api(`/api/problems/${first.id}`)).problem;
    } else if (!first) {
      selectedProblemId = null;
      editing = null;
    }

    document.getElementById("admin-body").innerHTML = `
      <div class="grid grid-2" style="align-items:start">
        <div>
          <div class="panel" style="margin-bottom:16px">
            <div class="panel-title"><h3>Problems <span class="pill-count">${adminProblems.length}</span></h3>
              <button class="btn btn-sm btn-primary" id="new-problem">+ New problem</button></div>
            <div class="table-wrap"><table>
              <thead><tr><th>Title</th><th>Difficulty</th><th class="num">Tests</th><th>Vis</th><th></th></tr></thead>
              <tbody>${adminProblems.map((p) => `<tr>
                <td><strong>${esc(p.title)}</strong></td>
                <td>${difficultyBadge(p.difficulty)}</td>
                <td class="num">${p.test_count}</td>
                <td class="muted">${p.visibility}</td>
                <td><button class="btn btn-sm" data-edit="${p.id}">Edit</button></td>
              </tr>`).join("")}</tbody>
            </table></div>
          </div>
          <div class="panel" id="tests-panel">
            <div id="tests-box"><div class="loading-screen">Loading…</div></div>
          </div>
        </div>
        <div id="form-slot">${problemForm(editing)}</div>
      </div>`;

    const wireForm = () => {
      const form = document.getElementById("p-form");
      form.onsubmit = async (e) => {
        e.preventDefault();
        const body = {
          title: document.getElementById("pf-title").value.trim(),
          slug: document.getElementById("pf-slug").value.trim() || undefined,
          difficulty: document.getElementById("pf-diff").value,
          tags: document.getElementById("pf-tags").value.trim(),
          visibility: document.getElementById("pf-vis").value,
          time_limit_ms: Number(document.getElementById("pf-tl").value),
          memory_limit_mb: Number(document.getElementById("pf-ml").value),
          statement: document.getElementById("pf-stmt").value,
          input_spec: document.getElementById("pf-in").value,
          output_spec: document.getElementById("pf-out").value,
          constraints: document.getElementById("pf-cons").value,
        };
        try {
          if (editing) {
            const { problem } = await api(`/api/problems/${editing.id}`, { method: "PUT", body });
            editing = problem;
            toast("Problem saved", "ok");
          } else {
            const { problem } = await api("/api/problems", { method: "POST", body });
            editing = problem;
            selectedProblemId = problem.id;
            toast("Problem created — add test cases now", "ok");
          }
          problemsTab();
        } catch (e2) { fail(e2); }
      };
      document.getElementById("pf-cancel").onclick = () => {
        editing = null;
        document.getElementById("form-slot").innerHTML = problemForm(null);
        wireForm();
      };
      const del = document.getElementById("pf-delete");
      if (del) del.onclick = async () => {
        if (!confirm("Delete this problem and all its submissions/test cases?")) return;
        try { await api(`/api/problems/${editing.id}`, { method: "DELETE" }); editing = null; selectedProblemId = null; toast("Deleted", "ok"); problemsTab(); }
        catch (e) { fail(e); }
      };
    };
    wireForm();

    document.getElementById("new-problem").onclick = () => {
      editing = null;
      document.getElementById("form-slot").innerHTML = problemForm(null);
      wireForm();
      document.getElementById("pf-title").focus();
    };
    document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = async () => {
      const id = b.dataset.edit;
      try {
        editing = (await api(`/api/problems/${id}`)).problem;
        selectedProblemId = id;
        document.getElementById("form-slot").innerHTML = problemForm(editing);
        wireForm();
        loadTests(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) { fail(e); }
    }));

    await loadTests(selectedProblemId);
  }

  /* ---------------- contests ---------------- */
  async function contestsTab() {
    shell("contests", "");
    const { contests } = await api("/api/contests");
    const problemsResp = await api("/api/problems");
    const now = Date.now();

    document.getElementById("admin-body").innerHTML = `
      <div class="grid grid-2" style="align-items:start">
        <div class="panel">
          <div class="panel-title"><h3>Contests <span class="pill-count">${contests.length}</span></h3></div>
          <div class="table-wrap"><table>
            <thead><tr><th>Title</th><th>Status</th><th class="num">Problems</th><th>Window</th><th></th></tr></thead>
            <tbody>${contests.map((c) => `<tr>
              <td><a href="#/contest/${c.id}"><strong>${esc(c.title)}</strong></a></td>
              <td><span class="status-pill status-${c.status}">${c.status}</span></td>
              <td class="num">${c.problems.length}</td>
              <td class="muted" style="font-size:12.5px">${fmtDate(c.starts_at)}<br>→ ${fmtDate(c.ends_at)}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-sm" data-cedit="${c.id}">Edit</button>
                <button class="btn btn-sm btn-danger" data-cdel="${c.id}">Delete</button>
              </td>
            </tr>`).join("") || `<tr><td colspan="5" class="empty">No contests</td></tr>`}</tbody>
          </table></div>
        </div>

        <div class="panel">
          <div class="panel-title"><h3 id="c-form-title">Create contest</h3></div>
          <form id="c-form">
            <label>Title *</label><input id="cf-title" required />
            <label>Description</label><textarea id="cf-desc" rows="3"></textarea>
            <div class="form-row">
              <div><label>Starts</label><input id="cf-start" type="datetime-local" /></div>
              <div><label>Ends</label><input id="cf-end" type="datetime-local" /></div>
            </div>
            <label>Visibility</label>
            <select id="cf-vis"><option value="public">public</option><option value="private">private</option></select>
            <div style="display:flex;gap:8px;margin-top:14px">
              <button class="btn btn-primary" type="submit">Create</button>
              <button class="btn" type="button" id="cf-reset">Clear</button>
            </div>
          </form>

          <div id="c-problems" class="hidden" style="margin-top:20px;border-top:1px solid var(--border);padding-top:14px">
            <div class="panel-title"><h3>Contest problems</h3></div>
            <div id="cp-list"></div>
            <div class="form-row" style="margin-top:8px">
              <select id="cp-sel">${problemsResp.problems.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join("")}</select>
              <input id="cp-score" type="number" value="100" min="1" title="score" style="max-width:110px" />
              <button class="btn btn-sm" id="cp-add" style="align-self:center">Add</button>
            </div>
          </div>
        </div>
      </div>`;

    const toLocal = (ts) => new Date(ts - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    let editingId = null;

    const resetForm = () => {
      editingId = null;
      document.getElementById("c-form-title").textContent = "Create contest";
      document.getElementById("c-form").reset();
      document.getElementById("cf-start").value = toLocal(Date.now());
      document.getElementById("cf-end").value = toLocal(Date.now() + 3 * 3600000);
      document.getElementById("c-problems").classList.add("hidden");
    };
    resetForm();

    const loadContestProblems = async (id) => {
      const { contest } = await api(`/api/contests/${id}`);
      const box = document.getElementById("cp-list");
      document.getElementById("c-problems").classList.remove("hidden");
      box.innerHTML = contest.problems.map((p) => `
        <div class="test-card" style="display:flex;justify-content:space-between;align-items:center">
          <span><strong>${esc(p.title)}</strong> <span class="muted">· ${p.score} pts · ${esc(p.difficulty)}</span></span>
          <button class="btn btn-sm btn-danger" data-cpdel="${p.id}">Remove</button>
        </div>`).join("") || `<div class="empty">No problems yet</div>`;
      box.querySelectorAll("[data-cpdel]").forEach((b) => (b.onclick = async () => {
        try { await api(`/api/contests/${id}/problems/${b.dataset.cpdel}`, { method: "DELETE" }); loadContestProblems(id); }
        catch (e) { fail(e); }
      }));
      document.getElementById("cp-add").onclick = async () => {
        try {
          await api(`/api/contests/${id}/problems`, {
            method: "POST",
            body: { problem_id: Number(document.getElementById("cp-sel").value), score: Number(document.getElementById("cp-score").value) },
          });
          loadContestProblems(id);
        } catch (e) { fail(e); }
      };
    };

    document.getElementById("c-form").onsubmit = async (e) => {
      e.preventDefault();
      const starts = new Date(document.getElementById("cf-start").value).getTime();
      const ends = new Date(document.getElementById("cf-end").value).getTime();
      const body = {
        title: document.getElementById("cf-title").value.trim(),
        description: document.getElementById("cf-desc").value.trim(),
        starts_at: starts, ends_at: ends,
        visibility: document.getElementById("cf-vis").value,
      };
      try {
        if (editingId) {
          const { contest } = await api(`/api/contests/${editingId}`, { method: "PUT", body });
          toast("Contest saved", "ok");
          await loadContestProblems(contest.id);
        } else {
          const { contest } = await api("/api/contests", { method: "POST", body });
          toast("Contest created", "ok");
          contestsTab();
          setTimeout(() => loadContestProblems(contest.id), 60);
          return;
        }
        contestsTab();
        setTimeout(() => loadContestProblems(editingId), 60);
      } catch (err) { fail(err); }
    };

    document.getElementById("cf-reset").onclick = resetForm;

    document.querySelectorAll("[data-cedit]").forEach((b) => (b.onclick = async () => {
      const c = contests.find((x) => x.id === Number(b.dataset.cedit));
      editingId = c.id;
      document.getElementById("c-form-title").textContent = "Edit contest";
      document.getElementById("cf-title").value = c.title;
      document.getElementById("cf-desc").value = c.description;
      document.getElementById("cf-start").value = toLocal(c.starts_at);
      document.getElementById("cf-end").value = toLocal(c.ends_at);
      document.getElementById("cf-vis").value = c.visibility;
      loadContestProblems(c.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
    document.querySelectorAll("[data-cdel]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Delete this contest?")) return;
      try { await api(`/api/contests/${b.dataset.cdel}`, { method: "DELETE" }); toast("Deleted", "ok"); contestsTab(); }
      catch (e) { fail(e); }
    }));
  }

  /* ---------------- admin submissions ---------------- */
  async function submissionsTab() {
    shell("submissions", "");
    const { submissions } = await api("/api/admin/submissions?limit=100");
    document.getElementById("admin-body").innerHTML = `
      <div class="panel"><div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>User</th><th>Problem</th><th>Lang</th><th>Verdict</th><th class="num">Time</th><th class="num">Mem</th><th class="num">When</th><th></th></tr></thead>
        <tbody>${submissions.map((s) => `<tr>
          <td><a href="#/submission/${s.id}" class="mono">#${s.id}</a></td>
          <td>${esc(s.username)}</td>
          <td>${esc(s.problem_title)} ${s.mode === "sample" ? '<span class="badge badge-user">sample</span>' : ""}</td>
          <td class="mono" style="font-size:12.5px">${esc(s.language)}</td>
          <td>${verdictBadge(s.verdict, s.status)}</td>
          <td class="num mono">${s.time_ms ?? "—"}${s.time_ms != null ? " ms" : ""}</td>
          <td class="num mono">${memStr(s.memory_kb)}</td>
          <td class="num muted">${timeAgo(s.created_at)}</td>
          <td><button class="btn btn-sm btn-danger" data-del="${s.id}">Delete</button></td>
        </tr>`).join("")}</tbody>
      </table></div></div>`;
    document.querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
      if (!confirm("Delete submission #" + b.dataset.del + "?")) return;
      try { await api(`/api/admin/submissions/${b.dataset.del}`, { method: "DELETE" }); toast("Deleted", "ok"); submissionsTab(); }
      catch (e) { fail(e); }
    }));
  }

  window.AdminPages = {
    page: async (seg) => {
      const tab = seg[1] || "";
      if (tab === "users") return users();
      if (tab === "problems") return problemsTab();
      if (tab === "contests") return contestsTab();
      if (tab === "submissions") return submissionsTab();
      return overview();
    },
  };
})();
