import { JSDOM } from "jsdom";

const BASE = "http://localhost:3000";
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = fn(); if (v) return v; } catch {}
    await sleep(80);
  }
  throw new Error(`timeout waiting for: ${label}`);
}

async function makeSession(errors) {
  let cookie = "";
  const jfetch = async (input, init = {}) => {
    const url = new URL(String(input), BASE);
    const headers = new Headers(init.headers || {});
    if (cookie) headers.set("cookie", cookie);
    const res = await fetch(url, { ...init, headers });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return res;
  };

  const dom = new JSDOM(await (await fetch(BASE + "/")).text(), {
    url: BASE + "/",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = jfetch;
      window.scrollTo = () => {};
      window.confirm = () => true;
      window.addEventListener("error", (e) => errors.push(String(e.error || e.message)));
    },
  });
  return dom;
}

async function goto(win, hash) {
  win.location.hash = hash;
  win.dispatchEvent(new win.HashChangeEvent("hashchange"));
  await sleep(150);
}

async function main() {
  const errors = [];
  console.log("browser session: guest");
  const dom = await makeSession(errors);
  const win = dom.window;
  const doc = win.document;

  await waitFor(() => doc.querySelector(".hero h1"), "home hero");
  check("home renders", doc.querySelector(".hero h1").textContent.includes("Write code"));
  check("home stat cards", doc.querySelectorAll(".stat-card").length === 4);

  await goto(win, "#/problems");
  await waitFor(() => doc.querySelectorAll("#p-rows tr").length >= 8, "problem rows");
  check("problems list renders", doc.querySelectorAll("#p-rows tr").length >= 8, String(doc.querySelectorAll("#p-rows tr").length));
  const search = doc.getElementById("f-search");
  search.value = "fizz";
  search.dispatchEvent(new win.Event("input"));
  await sleep(50);
  check("search filter works", doc.querySelectorAll("#p-rows tr").length === 1, String(doc.querySelectorAll("#p-rows tr").length));
  search.value = "";
  search.dispatchEvent(new win.Event("input"));

  await goto(win, "#/problem/1");
  await waitFor(() => doc.getElementById("ed-code"), "editor");
  check("problem statement renders", doc.querySelector(".statement").textContent.includes("Given two integers"));
  check("samples rendered", doc.querySelectorAll(".sample").length === 2);
  check("limits shown", doc.querySelector(".limits").textContent.includes("1000 ms"));
  check("editor template loaded", doc.getElementById("ed-code").value.includes("input()"));

  // must be logged in to submit
  await goto(win, "#/login");
  await waitFor(() => doc.getElementById("a-user"), "login form");
  doc.getElementById("a-user").value = "alice";
  doc.getElementById("a-pass").value = "password123";
  doc.getElementById("a-go").click();
  await waitFor(() => doc.getElementById("auth-area").textContent.includes("Log out"), "logged in");
  check("login via UI", doc.getElementById("auth-area").textContent.includes("alice"));

  await goto(win, "#/problem/1");
  await waitFor(() => doc.getElementById("ed-code"), "editor again");
  const ta = doc.getElementById("ed-code");
  ta.value = "a, b = map(int, input().split())\nprint(a + b)\n";
  ta.dispatchEvent(new win.Event("input"));
  doc.getElementById("ed-submit").click();
  await waitFor(() => {
    const r = doc.querySelector("#result .verdict");
    return r && !r.textContent.includes("queue") && !r.textContent.includes("Running") && !r.textContent.includes("judging");
  }, "submission verdict");
  const verdict = doc.querySelector("#result .verdict").textContent;
  check("UI submission judged AC", verdict === "Accepted", verdict);
  await waitFor(() => doc.querySelectorAll("#my-subs tr").length >= 1, "my submissions");
  check("my submissions panel", doc.querySelector("#my-subs").textContent.includes("Accepted"));

  await goto(win, "#/submissions");
  await waitFor(() => doc.querySelectorAll("#s-rows tr").length >= 5, "submission rows");
  check("submissions feed", doc.querySelectorAll("#s-rows tr").length >= 5);

  await goto(win, "#/submission/1");
  await waitFor(() => doc.querySelector(".page-head h1"), "submission detail");
  check("submission detail", doc.querySelector(".page-head h1").textContent.includes("Submission #1"));

  await goto(win, "#/leaderboard");
  await waitFor(() => doc.querySelectorAll("tbody tr").length >= 4, "leaderboard rows");
  check("leaderboard renders", doc.querySelector("tbody").textContent.includes("alice"));

  await goto(win, "#/contests");
  await waitFor(() => doc.querySelectorAll(".contest-card").length >= 3, "contest cards");
  check("contests list", doc.querySelectorAll(".contest-card").length >= 3);

  await goto(win, "#/contest/1");
  await waitFor(() => doc.querySelector(".tabs"), "contest tabs");
  await sleep(300);
  check("contest detail", doc.querySelector(".page-head h1").textContent.includes("Starter Sprint"));
  check("contest problems listed", doc.querySelectorAll("#tab-body tbody tr").length >= 3);
  doc.querySelectorAll(".tab")[1].click();
  await waitFor(() => doc.querySelectorAll("#standings tbody tr").length >= 3, "standings");
  check("contest standings", doc.querySelectorAll("#standings tbody tr").length >= 3);
  check("standings has penalty", doc.getElementById("standings").textContent.includes("Penalty"));

  await goto(win, "#/profile/alice");
  await waitFor(() => doc.querySelector(".page-head h1"), "profile");
  check("profile page", doc.querySelector(".page-head h1").textContent.includes("alice"));

  console.log("browser session: admin");
  const dom2 = await makeSession(errors);
  const w2 = dom2.window, d2 = w2.document;
  await waitFor(() => d2.querySelector(".hero h1"), "admin home");
  await goto(w2, "#/login");
  await waitFor(() => d2.getElementById("a-user"), "login form");
  d2.getElementById("a-user").value = "admin";
  d2.getElementById("a-pass").value = "admin123";
  d2.getElementById("a-go").click();
  await waitFor(() => d2.getElementById("auth-area").textContent.includes("admin"), "admin logged in");
  check("admin nav visible", !d2.getElementById("nav-admin").hidden);

  await goto(w2, "#/admin");
  await waitFor(() => d2.getElementById("admin-body") && d2.getElementById("admin-body").textContent.includes("Verdict"), "admin overview");
  check("admin overview", d2.querySelectorAll(".stat-card").length >= 8, String(d2.querySelectorAll(".stat-card").length));
  check("verdict bars", d2.querySelectorAll(".bar-row").length >= 3);

  await goto(w2, "#/admin/problems");
  await waitFor(() => d2.getElementById("tests-box") && d2.getElementById("tests-box").textContent.includes("Test cases"), "test manager");
  check("admin problems tab", d2.querySelectorAll("[data-edit]").length >= 8, String(d2.querySelectorAll("[data-edit]").length));
  check("problem form present", !!d2.getElementById("p-form"));
  check("test cards present", d2.querySelectorAll(".test-card").length >= 1);

  await goto(w2, "#/admin/users");
  await waitFor(() => d2.querySelectorAll("[data-ban]").length >= 5, "user rows");
  check("admin users tab", d2.body.textContent.includes("admin") && d2.querySelectorAll("[data-ban]").length >= 5);

  await goto(w2, "#/admin/contests");
  await waitFor(() => d2.getElementById("c-form"), "contest form");
  check("admin contests tab", d2.querySelectorAll("[data-cedit]").length >= 2);

  await goto(w2, "#/admin/submissions");
  await waitFor(() => d2.querySelectorAll("[data-del]").length >= 5, "admin submissions rows");
  check("admin submissions tab", d2.querySelectorAll("[data-del]").length >= 5);

  check("no runtime JS errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  console.log(`\n${pass} passed, ${fail} failed`);
  dom.window.close();
  dom2.window.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

