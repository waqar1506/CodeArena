#!/usr/bin/env python3
"""Generates CodeArena_Project_Guide.pdf - a complete guide to the CodeArena project.

Usage:  python tools/make_project_pdf.py [output.pdf]
"""
import sys
from fpdf import FPDF
from fpdf.fonts import FontFace
from fpdf.enums import XPos, YPos

OUT = sys.argv[1] if len(sys.argv) > 1 else "CodeArena_Project_Guide.pdf"

# ---------------------------------------------------------------- palette
ACCENT = (31, 78, 121)
ACCENT2 = (46, 120, 180)
TXT = (33, 37, 41)
MUTED = (110, 120, 134)
BORDER = (205, 210, 218)
CODE_BG = (244, 246, 249)
CODE_BORDER = (222, 227, 234)
CODE_TXT = (40, 46, 56)
GREEN = (30, 125, 75)

USABLE = 210 - 36  # A4 width minus 18mm margins

PAGES = {}          # filled in pass 1, used by the TOC in pass 2

TOC = [
    (1, "1. Project Overview"),
    (2, "1.1 Feature coverage"),
    (2, "1.2 Technology stack"),
    (2, "1.3 Scope and limitations"),
    (1, "2. Features in Detail"),
    (2, "2.1 Authentication and accounts"),
    (2, "2.2 Problem management"),
    (2, "2.3 Test case system"),
    (2, "2.4 Code submission and verdicts"),
    (2, "2.5 Time and memory limits"),
    (2, "2.6 Submission history"),
    (2, "2.7 Leaderboard and scoring"),
    (2, "2.8 Contests"),
    (2, "2.9 Admin dashboard"),
    (2, "2.10 User interface and editor"),
    (1, "3. System Architecture"),
    (2, "3.1 High level design"),
    (2, "3.2 Request and judging lifecycles"),
    (2, "3.3 Project structure"),
    (2, "3.4 Design decisions"),
    (1, "4. Data Model"),
    (1, "5. The Judge Engine"),
    (2, "5.1 Judging pipeline"),
    (2, "5.2 Language matrix"),
    (2, "5.3 Output comparison rules"),
    (2, "5.4 Memory measurement on Windows"),
    (2, "5.5 Security considerations"),
    (1, "6. REST API Reference"),
    (1, "7. Frontend"),
    (1, "8. How the Project Was Created"),
    (2, "8.1 Build phases"),
    (2, "8.2 Bug log: problems found and fixed"),
    (1, "9. Testing and Verification"),
    (1, "10. Learning Roadmap"),
    (2, "10.1 Level 1 - Web fundamentals"),
    (2, "10.2 Level 2 - Backend with Node.js and Express"),
    (2, "10.3 Level 3 - Databases and SQL"),
    (2, "10.4 Level 4 - Security"),
    (2, "10.5 Level 5 - Operating systems and process control"),
    (2, "10.6 Level 6 - Algorithms and problem solving"),
    (2, "10.7 Level 7 - Software engineering practice"),
    (2, "10.8 Level 8 - Testing and quality"),
    (2, "10.9 Level 9 - Deployment and scaling"),
    (2, "10.10 Suggested study order"),
    (1, "11. Ideas to Extend the Project"),
    (1, "12. Appendix: Commands, Accounts, File Map"),
]


class Guide(FPDF):
    def header(self):
        if self.page_no() <= 2:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.set_xy(self.l_margin, 7)
        self.cell(0, 4, text="CodeArena - Online Coding Judge   |   Project Guide & Learning Roadmap")
        self.set_draw_color(*BORDER)
        self.line(self.l_margin, 12.5, self.w - self.r_margin, 12.5)
        self.set_y(self.t_margin + 2)

    def footer(self):
        if self.page_no() == 1:
            return
        self.set_y(-13)
        self.set_draw_color(*BORDER)
        self.line(self.l_margin, self.y, self.w - self.r_margin, self.y)
        self.set_y(-10)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, text="Page %d of {nb}" % self.page_no(), align="C")


# ---------------------------------------------------------------- helpers
def need(h):
    if pdf.y + h > pdf.h - pdf.b_margin - 2:
        pdf.add_page()


def gap(h=2.0):
    pdf.ln(h)


def h1(title):
    need(26)
    PAGES[title] = pdf.page_no()
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 17)
    pdf.set_text_color(*ACCENT)
    pdf.multi_cell(0, 8, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_draw_color(*ACCENT2)
    y = pdf.y
    pdf.set_line_width(0.7)
    pdf.line(pdf.l_margin, y, pdf.l_margin + 62, y)
    pdf.set_line_width(0.2)
    pdf.ln(5)


def h2(title):
    base, sep, rest = title.partition(" (")
    rest = "(" + rest if sep else ""
    need(20)
    if PAGES.get(base) is None:
        PAGES[base] = pdf.page_no()
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 12.5)
    pdf.set_text_color(*ACCENT2)
    pdf.multi_cell(0, 6.6, base, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if rest:
        pdf.set_font("Helvetica", "", 9.2)
        pdf.set_text_color(*MUTED)
        pdf.multi_cell(0, 4.6, rest, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.5)


def h3(title):
    need(14)
    pdf.ln(1.5)
    pdf.set_font("Helvetica", "B", 10.8)
    pdf.set_text_color(*TXT)
    pdf.multi_cell(0, 5.6, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(0.8)


def para(txt, size=9.8, lh=5.0, indent=0, color=TXT, style=""):
    pdf.set_font("Helvetica", style, size)
    pdf.set_text_color(*color)
    x0 = pdf.l_margin + indent
    pdf.set_x(x0)
    pdf.multi_cell(pdf.w - pdf.r_margin - x0, lh, txt,
                   new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(1.6)


def note(txt):
    need(16)
    pdf.ln(1)
    pdf.set_fill_color(235, 242, 250)
    x, y = pdf.x, pdf.y
    pdf.set_font("Helvetica", "", 9.3)
    pdf.set_text_color(*ACCENT)
    pdf.set_x(pdf.l_margin + 3)
    pdf.multi_cell(pdf.w - pdf.r_margin - pdf.l_margin - 8, 4.9, txt,
                   new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    h = pdf.y - y
    pdf.set_fill_color(235, 242, 250)
    pdf.set_draw_color(*ACCENT2)
    pdf.rect(x + 1, y, 1.6, h, style="F")
    pdf.set_text_color(*TXT)
    pdf.ln(3)


def bullets(items, size=9.8, indent=1.5, lh=5.0):
    for it in items:
        pdf.set_font("Helvetica", "", size)
        x0 = pdf.l_margin + indent
        need(lh + 2)
        pdf.set_xy(x0, pdf.y)
        pdf.set_text_color(*ACCENT2)
        pdf.cell(4.5, lh, text=">")
        pdf.set_text_color(*TXT)
        pdf.set_x(x0 + 4.5)
        pdf.multi_cell(pdf.w - pdf.r_margin - x0 - 4.5, lh, it,
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2.2)


def numbered(items, size=9.8, lh=5.0):
    for i, it in enumerate(items, 1):
        pdf.set_font("Helvetica", "", size)
        x0 = pdf.l_margin + 1.5
        need(lh + 2)
        pdf.set_xy(x0, pdf.y)
        pdf.set_text_color(*ACCENT2)
        pdf.set_font("Helvetica", "B", size)
        pdf.cell(8, lh, text="%d." % i)
        pdf.set_font("Helvetica", "", size)
        pdf.set_text_color(*TXT)
        pdf.set_x(x0 + 8)
        pdf.multi_cell(pdf.w - pdf.r_margin - x0 - 8, lh, it,
                       new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(2.2)


def _wrap_code(lines, max_chars):
    out = []
    for ln in lines:
        ln = ln.replace("\t", "    ")
        while len(ln) > max_chars:
            out.append(ln[:max_chars])
            ln = ln[max_chars:]
        out.append(ln)
    return out


def code_block(text, size=8.4, title=None):
    lines = text.split("\n") if isinstance(text, str) else list(text)
    max_chars = max(20, int((USABLE - 5) / (size * 0.2117)))
    lines = _wrap_code(lines, max_chars)
    lh = size * 0.50
    if title:
        need(lh * 2 + 12)
        pdf.set_font("Helvetica", "B", 8.6)
        pdf.set_text_color(*MUTED)
        pdf.multi_cell(0, 4.4, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(0.6)
    i = 0
    while i < len(lines):
        need(lh * 3 + 8)
        avail = pdf.h - pdf.b_margin - pdf.y - 3
        n = max(1, int(avail // lh))
        chunk = lines[i:i + n]
        box_h = len(chunk) * lh + 3.4
        pdf.set_fill_color(*CODE_BG)
        pdf.set_draw_color(*CODE_BORDER)
        pdf.set_line_width(0.25)
        pdf.rect(pdf.l_margin, pdf.y, USABLE, box_h, style="DF")
        pdf.set_font("Courier", "", size)
        pdf.set_text_color(*CODE_TXT)
        y = pdf.y + 1.7
        for ln in chunk:
            pdf.set_xy(pdf.l_margin + 2.5, y)
            pdf.cell(USABLE - 5, lh, text=ln)
            y += lh
        pdf.set_y(pdf.y + box_h + 3)
        i += n
        if i < len(lines):
            pdf.add_page()


def table(headers, rows, widths, size=8.4, lh=4.7, title=None):
    if title:
        need(20)
        pdf.set_font("Helvetica", "B", 9.4)
        pdf.set_text_color(*ACCENT2)
        pdf.multi_cell(0, 5.2, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)
    need(22)
    pdf.set_font("Helvetica", "", size)
    pdf.set_text_color(*TXT)
    pdf.set_draw_color(*BORDER)
    total = sum(widths)
    cols = [w / total * USABLE for w in widths]
    with pdf.table(
        col_widths=cols,
        headings_style=FontFace(emphasis="BOLD", color=(255, 255, 255), fill_color=ACCENT),
        line_height=lh,
        padding=(1.1, 1.6, 1.1, 1.6),
        text_align="LEFT",
        first_row_as_headings=bool(headers),
        borders_layout="HORIZONTAL_LINES",
        cell_fill_color=(249, 250, 252),
        cell_fill_mode="ROWS",
    ) as t:
        if headers:
            r = t.row()
            for c in headers:
                r.cell(str(c))
        for row in rows:
            r = t.row()
            for c in row:
                r.cell(str(c))
    pdf.ln(3.5)


# ---------------------------------------------------------------- cover
def cover():
    pdf.set_fill_color(*ACCENT)
    pdf.rect(0, 0, 210, 84, style="F")
    pdf.set_fill_color(*ACCENT2)
    pdf.rect(0, 84, 210, 3.5, style="F")

    pdf.set_xy(18, 18)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 6, text="PROJECT DOCUMENTATION  /  LEARNING GUIDE")
    pdf.set_xy(18, 30)
    pdf.set_font("Helvetica", "B", 40)
    pdf.cell(0, 16, text="CodeArena")
    pdf.set_xy(18, 49)
    pdf.set_font("Helvetica", "", 17)
    pdf.cell(0, 9, text="Online Coding Judge")
    pdf.set_xy(18, 59)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(215, 228, 242)
    pdf.multi_cell(150, 5.6,
                   "A complete, working judge platform: user authentication, problem "
                   "management, code execution with time and memory limits, a verdict "
                   "system, submission history, leaderboard, contests and an admin "
                   "dashboard - built with Node.js, Express, SQLite and vanilla "
                   "JavaScript.")

    pdf.set_y(92)
    pdf.set_text_color(*TXT)
    table(None, [
        ["Type", "Full-stack web application + code execution engine"],
        ["Runtime", "Node.js 26 (ES modules), Express 5, node:sqlite"],
        ["Frontend", "Single page app in vanilla HTML / CSS / JavaScript - no build step"],
        ["Languages judged", "C++ (g++), Python 3, Java 16, JavaScript (Node.js)"],
        ["Tests", "71 automated tests: 41 API/judge tests + 30 browser UI tests"],
        ["Database", "SQLite file (data/codearena.db) with 10 tables"],
        ["Date", "October 2026"],
    ], [26, 74], size=9.6, lh=5.6)

    pdf.ln(6)
    pdf.set_fill_color(235, 242, 250)
    pdf.set_draw_color(*ACCENT2)
    y = pdf.y
    pdf.set_x(21)
    pdf.set_text_color(*ACCENT)
    pdf.set_font("Helvetica", "", 9.6)
    pdf.multi_cell(168, 5.2,
                   "This guide explains every feature, how the system was designed and "
                   "built, the real bugs that were found while creating it, and the full "
                   "list of topics you need to learn to be able to build a project like "
                   "this yourself.",
                   new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.rect(19, y, 2, pdf.y - y, style="F")
    pdf.set_text_color(*TXT)


# ---------------------------------------------------------------- toc
def toc_page():
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(*ACCENT)
    pdf.multi_cell(0, 10, "Table of Contents", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(3)
    y = pdf.y
    for level, title in TOC:
        page = PAGES.get(title)
        page = str(page) if page is not None else "00"
        if level == 1:
            pdf.set_font("Helvetica", "B", 10.4)
            pdf.set_text_color(*TXT)
            x0 = pdf.l_margin
            w = USABLE
            row = 5.6
        else:
            pdf.set_font("Helvetica", "", 9.6)
            pdf.set_text_color(70, 78, 90)
            x0 = pdf.l_margin + 7
            w = USABLE - 7
            row = 5.2
        pdf.set_xy(x0, y)
        pdf.cell(w - 14, row, text=title)
        pdf.set_xy(x0 + w - 14, y)
        pdf.cell(14, row, text=page, align="R")
        y += row
    pdf.set_y(y)
    pdf.ln(4)


# ================================================================ chapters
def ch1():
    h1("1. Project Overview")
    para("CodeArena is an online coding judge - a web platform where programmers pick a "
         "programming problem, write a solution in C++, Python, Java or JavaScript inside "
         "the browser, submit it, and get an automatic verdict (Accepted, Wrong Answer, "
         "Time Limit Exceeded, ...) computed against a set of official test cases. It is "
         "the same idea as Codeforces, LeetCode or CodeChef, implemented from scratch as "
         "a single self-contained project.")
    para("The project deliberately covers every layer of a real web product: front-end "
         "interface, REST API, authentication and authorization, relational database "
         "schema, background job processing, native OS process control, security "
         "hardening, and an automated test suite. That breadth is what makes it a good "
         "vehicle for learning full-stack development end to end.")

    h2("1.1 Feature coverage")
    table(["Required feature", "How it is implemented", "Main files"], [
        ["User authentication", "Register / login / logout with scrypt password hashing, "
         "server-side sessions in SQLite, HttpOnly cookie, roles (user, admin)",
         "server/auth.js, server/routes/authRoutes.js"],
        ["Problem management", "Full CRUD for admins: title, slug, difficulty, tags, "
         "markdown statement, limits, visibility; public listing with search and filters",
         "server/routes/problemRoutes.js"],
        ["Code submission", "POST /api/submissions with language + source; queued and "
         "judged asynchronously; status polled by the browser",
         "server/routes/submissionRoutes.js"],
        ["Test cases", "Per problem sample and hidden tests with input / expected output; "
         "managed by admins; hidden outputs are never revealed",
         "test_cases table, admin UI"],
        ["Submission history", "Global feed, per-user list, per-problem list; detail page "
         "with per-test results, timing, memory and source code",
         "submissionRoutes.js, public/js/app.js"],
        ["Leaderboard", "Ranked by score (difficulty weight), then solved count, then "
         "fewer attempts; computed with SQL subqueries",
         "server/routes/miscRoutes.js"],
        ["Contest creation", "Admin creates contests with start/end time, attaches "
         "problems with point values, users register, live standings with penalties",
         "server/routes/contestRoutes.js"],
        ["Time / memory limits", "Per problem; enforced by killing the process at the "
         "limit and by a native memory watcher (peak RSS)",
         "server/judge/judge.js, memwatch.cpp"],
        ["Verdict system", "AC, WA, TLE, MLE, RE, CE, OLE, IE with per-test breakdown",
         "server/judge/judge.js"],
        ["Admin dashboard", "Statistics, verdict chart, queue depth, user ban / promote, "
         "problem and test editors, contest editor, submission cleanup",
         "public/js/admin.js, server/routes/adminRoutes.js"],
    ], [24, 46, 30], title="Table 1.1 - Requirement to implementation map")

    h2("1.2 Technology stack")
    table(["Layer", "Choice", "Why it was chosen"], [
        ["Server", "Node.js 26 + Express 5", "Single language across the whole project, "
         "excellent child-process control for the judge, huge ecosystem"],
        ["Database", "node:sqlite (built in)", "Zero native dependencies to install, "
         "file-based, one file to back up; SQLite is ideal for this scale"],
        ["Frontend", "Vanilla JS single page app", "No build step, no framework to learn "
         "first; hash router, fetch API, DOM manipulation"],
        ["Editor", "Textarea + line-number gutter", "Keeps the project dependency free; "
         "draft autosave in localStorage"],
        ["Password hashing", "crypto.scryptSync + random salt", "Memory-hard KDF built "
         "into Node; safe default without extra packages"],
        ["Judge", "child_process.spawn per test", "Isolated process per test case, "
         "direct control of stdin / stdout / kill"],
        ["Memory limit", "memwatch.exe (C++ helper)", "Reads PeakWorkingSetSize through "
         "the Windows API; polling tasklist was too slow and distorted timings"],
        ["Testing", "Node test scripts + jsdom", "41 API tests and 30 real DOM tests run "
         "with 'npm test'"],
    ], [16, 30, 54], title="Table 1.2 - Technology choices")

    h2("1.3 Scope and limitations")
    bullets([
        "Code execution is NOT sandboxed: submitted programs run as the same OS user as "
        "the server. This is acceptable for a local learning project, but a production "
        "judge must run submissions in Docker / gVisor or under a restricted account "
        "with seccomp, namespaces and cgroups.",
        "The judge queue is in-process and serial (one submission at a time), so it "
        "cannot scale to many cores without moving the queue to a worker pool or a "
        "message broker (Redis / RabbitMQ).",
        "SQLite with WAL mode is perfect for hundreds of users; a busy commercial judge "
        "would migrate to PostgreSQL.",
        "The interface is desktop first and has no offline mode or push notifications; "
        "standings refresh on a timer rather than over WebSockets.",
        "There is no email verification, password reset, OAuth, or two-factor "
        "authentication.",
    ])


def ch2():
    h1("2. Features in Detail")

    h2("2.1 Authentication and accounts")
    para("Anyone can browse problems and the leaderboard anonymously. Registering gives "
         "you a profile, submission history, contest participation and leaderboard rank.")
    bullets([
        "Registration: username must match [a-zA-Z0-9_]{3,24}, password must be 6-128 "
        "characters; both are validated server side.",
        "Password storage: crypto.scryptSync(password, random-16-byte-salt, 64) stored as "
        "hex, so identical passwords never produce identical rows.",
        "Verification uses crypto.timingSafeEqual to avoid timing side channels.",
        "Sessions: a 32-byte random token is stored in the sessions table and sent as an "
        "HttpOnly, SameSite=Lax cookie valid for 14 days.",
        "Every request runs through sessionMiddleware which resolves req.user, so route "
        "guards (requireAuth, requireAdmin) are one line.",
        "Banning a user deletes all of their sessions immediately, logging them out "
        "everywhere.",
        "The first registered user automatically becomes admin (relevant on a fresh "
        "database); afterwards admins promote users from the dashboard.",
        "The client keeps the current user in memory (GET /api/auth/me on boot) and "
        "re-renders the navigation accordingly.",
    ])

    h2("2.2 Problem management")
    para("Admins build the problem set from the Admin > Problems tab: a form on the right "
         "creates or edits a problem, the list on the left shows every problem including "
         "private ones.")
    bullets([
        "Fields: title, slug (auto-generated, unique, used in URLs), difficulty "
        "(easy/medium/hard), comma-separated tags, markdown statement, input format, "
        "output format, constraints, time limit in ms (100-10000), memory limit in MB "
        "(16-1024), visibility (public / private).",
        "Private problems are hidden from listings and from normal users - useful for "
        "drafting a contest problem before the contest starts.",
        "The public list supports live text search plus difficulty and tag dropdowns, "
        "and shows solved/attempt markers, AC counts, number of tests and the limits.",
        "Deleting a problem cascades to its tests and submissions (foreign keys with "
        "ON DELETE CASCADE).",
        "Statements are a safe subset of markdown (headings, lists, code fences, bold, "
        "inline code) rendered by a small custom renderer that escapes all HTML first - "
        "so a problem statement cannot inject script into the page.",
    ])

    h2("2.3 Test case system")
    para("Each problem carries an ordered list of test cases. Judges call the first few "
         "of them 'samples' because they are shown on the problem page with worked "
         "examples; the rest are hidden and are only used during judging.")
    bullets([
        "Admin UI: add a test (starts as an empty input/expected pair), edit both text "
        "areas, toggle the sample flag, save or delete; tests are numbered by position.",
        "Sample tests appear on the problem page as Input / Output boxes exactly like a "
         "real contest statement.",
        "When a submission fails on a SAMPLE test, the judge returns the expected and "
        "actual output so the user can debug; when it fails on a hidden test only the "
        "test number is shown, so answers cannot be reverse engineered.",
        "The 'Run samples' button judges a submission against samples only (mode = "
        "'sample'); sample runs are excluded from history, statistics and the "
        "leaderboard.",
        "The seeded database ships 8 problems with 71 generated tests, including large "
        "stress tests (n = 200000) to catch O(n^2) solutions.",
    ])

    h2("2.4 Code submission and verdicts")
    para("The submission panel on each problem page has a language selector and a code "
         "editor (tab indentation, Ctrl+Enter to submit, per-problem drafts saved in "
         "localStorage). Submitting creates a row with status 'queued', pushes it into "
         "the judge queue, and the page polls GET /api/submissions/:id every 700 ms "
         "until the verdict appears.")
    table(["Verdict", "Meaning", "Typical cause"], [
        ["AC - Accepted", "All test cases passed", "Correct solution"],
        ["WA - Wrong Answer", "Program finished but output differs from expected", "Logic "
         "bug, wrong data type, wrong whitespace handling"],
        ["TLE - Time Limit Exceeded", "Not finished within the time limit", "Too slow "
         "algorithm (O(n^2) on n = 200000), infinite loop"],
        ["MLE - Memory Limit Exceeded", "Peak memory went over the problem limit", "Huge "
         "arrays, memo tables, accidental copies"],
        ["RE - Runtime Error", "Non-zero exit code, signal, or crash", "Segfault, "
         "division by zero, unhandled exception, index error"],
        ["CE - Compilation Error", "Compiler failed before running", "Syntax error - the "
         "compiler output is shown in full"],
        ["OLE - Output Limit Exceeded", "Program produced more than 1 MB of output",
         "Debug printing inside a loop"],
        ["IE - Internal Error", "Judge-side problem", "Missing tests, unknown language, "
         "judge exception"],
    ], [22, 36, 42], title="Table 2.1 - Verdict system")
    bullets([
        "Only one submission per user may be in the queue at a time (HTTP 429 otherwise), "
        "which prevents a user from flooding the judge.",
        "Source code is limited to 200 KB.",
        "The detail page shows the final verdict, time, memory, tests passed / total, a "
        "chip per test with its own verdict and timing, plus the full compiler output for "
        "CE and stderr for RE (owner or admin only).",
        "Source code is visible only to its author and to admins.",
    ])

    h2("2.5 Time and memory limits")
    h3("Time limit")
    para("Each problem stores time_limit_ms. For every test the judge starts the process "
         "and sets a timer for the effective limit; when it fires, the process is killed "
         "and the test is marked TLE. Effective limit = problem limit + a per-language "
         "startup allowance (C++ 0 ms, Python 300 ms, JavaScript 300 ms, Java 2000 ms), "
         "because the JVM and interpreters need time to boot even for an empty program. "
         "Measured time is wall-clock time from spawn to exit, including I/O.")
    h3("Memory limit")
    para("Each problem stores memory_limit_mb. A helper process (memwatch.exe) is started "
         "alongside the submitted program; it polls GetProcessMemoryInfo every 25 ms and "
         "keeps the highest PeakWorkingSetSize it sees. If the peak crosses the limit the "
         "helper exits with code 42, the judge immediately kills the program and records "
         "MLE. The final peak is also stored with the submission and shown in the UI. "
         "Language runtimes additionally receive heap caps (node --max-old-space-size, "
         "java -Xmx) so runaway allocations fail fast.")

    h2("2.6 Submission history")
    bullets([
        "Global feed at #/submissions with filters: 'only mine', verdict dropdown, "
        "username; auto-refreshes every 4 seconds while open.",
        "Per problem: 'Your submissions' table under the statement (refreshes every 3 "
        "seconds, so a queued submission updates in place).",
        "Per user: the profile page shows total / accepted / solved / acceptance rate "
        "plus the list of solved problems with timestamps.",
        "Detail page: verdict header, source code, result panel, per-test chips and "
        "messages; live polling while the submission is still queued or running.",
        "Admins get a management table (last 100 submissions, sample-run badge, delete "
        "button).",
    ])

    h2("2.7 Leaderboard and scoring")
    para("The leaderboard answers 'who is best' with a transparent, SQL-computed score:")
    code_block(
        "score  = sum of problem weights for every distinct problem the user solved\n"
        "         (easy = 100, medium = 200, hard = 300)\n"
        "solved = COUNT(DISTINCT problem_id) with verdict = 'AC'\n"
        "rank    ORDER BY score DESC, solved DESC, attempts ASC, first AC time, username")
    para("Everything is computed with correlated subqueries against the submissions table, "
         "so it can never go out of sync - there is no separate 'rating' column to "
         "maintain. The top-8 widget appears on the home page; the full board is at "
         "#/leaderboard and highlights your own row.")

    h2("2.8 Contests")
    para("Admins create contests from Admin > Contests: title, description, start and end "
         "time (datetime pickers), visibility, and an attached problem list where each "
         "problem carries a point value. Before the contest starts the problem titles are "
         "hidden from regular users.")
    bullets([
        "Users must click Register (registration closes when the contest ends; you can "
        "unregister only before the start).",
        "Submissions that are judged inside the contest window and belong to a contest "
        "problem are tagged with contest_id - the frontend detects the running contest "
        "automatically and adds a note under the editor.",
        "Standings follow the classic ICPC model: rank by problems solved, then by "
        "penalty time, where penalty = minutes from contest start to the first accepted "
        "submission + 20 minutes for each rejected attempt before it.",
        "The contest page has a live countdown (starts in / ends in), tabs for Problems "
        "and Standings, and a '+3' style cell display for solved/attempted problems.",
        "Standings are locked until the contest starts.",
    ])

    h2("2.9 Admin dashboard")
    bullets([
        "Overview: cards for users, problems, tests, submissions, accepted, in-queue, "
        "judge queue depth and contests; a verdict distribution bar chart; a 14-day "
        "submission column chart; most submitted problems with acceptance rate; most "
        "active users; recent submissions.",
        "Problems & tests: create/edit/delete problems and manage their test cases side "
        "by side in one screen.",
        "Contests: create/edit/delete contests, add or remove problems with scores.",
        "Users: role switcher (user/admin) and ban/unban buttons; banning revokes "
        "sessions; admins cannot demote or ban themselves.",
        "Submissions: browse the last 100, delete any of them.",
        "Access is protected twice: navigation entry is hidden for non-admins and every "
        "/api/admin/* route runs requireAdmin (401 without a session, 403 for users).",
    ])

    h2("2.10 User interface and editor")
    bullets([
        "Dark, code-oriented theme; sticky header with navigation and user chip.",
        "Hash based SPA router (#/problems, #/problem/5, #/submission/12, #/contest/1, "
        "#/admin/users ...) with active-nav highlighting and poller cleanup on every "
        "navigation (no orphan timers).",
        "Editor: monospace textarea with a synced line-number gutter, Tab inserts four "
        "spaces, Ctrl+Enter submits, drafts are saved per problem AND per language in "
        "localStorage, and the language template is restored when you switch back.",
        "Toasts for success/error feedback; empty states and loading placeholders "
        "everywhere; responsive grid that collapses on small screens.",
        "Everything is rendered with escaped data - user names, statements and source "
        "code are all HTML-escaped before insertion.",
    ])


def ch3():
    h1("3. System Architecture")

    h2("3.1 High level design")
    code_block(
        "Browser (public/index.html + js/app.js SPA)\n"
        "   |  fetch JSON  (cookie: ca_session)\n"
        "   v\n"
        "Express server (server/index.js, port 3000)\n"
        "   |-- sessionMiddleware  -> req.user\n"
        "   |-- /api/auth          register / login / logout / me / stats\n"
        "   |-- /api/problems      list, detail, CRUD, test cases\n"
        "   |-- /api/submissions    create, list, detail\n"
        "   |-- /api/contests       CRUD, register, standings\n"
        "   |-- /api/leaderboard    ranking + site statistics\n"
        "   |-- /api/admin          statistics, users, submissions\n"
        "   |-- static files       public/  (SPA fallback to index.html)\n"
        "   v\n"
        "SQLite (data/codearena.db, WAL mode, 10 tables)\n"
        "\n"
        "Submission flow:\n"
        "POST /api/submissions -> INSERT status='queued' -> enqueue(id)\n"
        "   -> judge queue (serial, in-process)\n"
        "   -> compile (C++/Java) -> run each test in its own process\n"
        "        |-- stdin: test input        |-- stdout/stderr captured\n"
        "        |-- timer kills at limit     |-- memwatch.exe watches RAM\n"
        "   -> UPDATE submission + submission_tests rows\n"
        "   -> browser polls /api/submissions/:id and renders the verdict")

    h2("3.2 Request and judging lifecycles")
    h3("Normal API request")
    numbered([
        "Browser sends fetch with the session cookie and JSON body.",
        "express.json parses the body (1 MB limit, invalid JSON -> 400).",
        "sessionMiddleware looks up the token in the sessions table and sets req.user.",
        "A route handler validates input, runs SQL and returns JSON.",
        "Errors funnel into the final error middleware which logs and returns 500; 404 for "
        "unknown /api paths; unknown page loads fall through to index.html so hash routes "
        "work after a refresh.",
    ])
    h3("Judging a submission")
    numbered([
        "INSERT a submission row (status 'queued') and push its id into the queue.",
        "The drain loop takes the next id and marks it 'running'.",
        "Write the source into data/jobs/<submissionId>/ with the right file name "
        "(main.cpp, main.py, Main.java detected from the public class, main.cjs or "
        "main.mjs detected from import/export syntax).",
        "Compile when needed: g++ -O2 -std=c++1z -o main.exe main.cpp or javac -d . "
        "Main.java (20 s timeout). Failure -> verdict CE with the compiler message.",
        "Load the problem's test cases (all tests, or only samples for a sample run).",
        "For each test: spawn the program, write input to stdin, close stdin, start the "
        "kill timer and memwatch.exe, read stdout (1 MB cap) and stderr (64 KB cap).",
        "On exit decide the verdict in this priority order: spawn error -> TLE -> OLE -> "
        "MLE -> language specific OOM -> non-zero exit (RE) -> output mismatch (WA) -> "
        "AC.",
        "Insert one submission_tests row per completed test; stop at the first failure "
        "(the classic 'first failing test' behaviour).",
        "Final UPDATE: verdict, message, max time, max memory, score, tests passed/total, "
        "judged_at; then delete the job directory.",
        "The frontend sees status 'judged' on its next poll and shows the result.",
    ])

    h2("3.3 Project structure")
    code_block(
        "codearena/\n"
        "  package.json               npm scripts: start, seed, reset, test\n"
        "  server/\n"
        "    index.js                 Express wiring, static files, error handler\n"
        "    db.js                    schema creation + get/all/run/tx helpers\n"
        "    auth.js                  scrypt hashing, sessions, requireAuth/requireAdmin\n"
        "    util.js                  HTML escaping, markdown renderer, output compare\n"
        "    seed.js                  demo users, 8 problems, 71 tests, 2 contests\n"
        "    routes/\n"
        "      authRoutes.js          /api/auth/*\n"
        "      problemRoutes.js       /api/problems/* incl. test cases\n"
        "      submissionRoutes.js    /api/submissions/*\n"
        "      contestRoutes.js       /api/contests/* + standings\n"
        "      miscRoutes.js          leaderboard, stats, profiles\n"
        "      adminRoutes.js         /api/admin/*\n"
        "    judge/\n"
        "      judge.js               queue, compile, run tests, verdicts\n"
        "      languages.js           compile/run commands per language\n"
        "      memwatch.cpp           native peak-memory helper (built to data/bin)\n"
        "  public/\n"
        "    index.html               app shell\n"
        "    styles.css               dark theme, components, responsive layout\n"
        "    js/app.js                router, pages, editor, polling\n"
        "    js/admin.js              admin dashboard tabs\n"
        "  test/\n"
        "    api.test.mjs             41 API + judge tests\n"
        "    frontend.test.mjs        30 jsdom browser tests\n"
        "  data/\n"
        "    codearena.db             SQLite database\n"
        "    bin/memwatch.exe         compiled memory helper\n"
        "    jobs/<submissionId>/     temporary sandbox folders (cleaned up)")

    h2("3.4 Design decisions")
    table(["Decision", "Alternative rejected", "Reason"], [
        ["In-process serial judge queue", "Worker threads / separate process",
         "Simple and race free at this scale; the queue is a plain array plus a drain "
         "flag"],
        ["node:sqlite (built in)", "better-sqlite3 / Prisma / Sequelize",
         "No native module to compile on Windows, no ORM magic, raw SQL stays readable"],
        ["Server-side sessions in DB", "JWT tokens",
         "Instant logout / ban (delete the row), no secret rotation, revocable"],
        ["Vanilla JS SPA", "React / Vue", "No build step; the whole app is two files and "
         "runs from any static server"],
        ["Wall-clock kill for TLE", "CPU time accounting", "Wall clock also catches I/O "
         "and sleep based abuse and is portable"],
        ["Native memwatch helper", "Polling tasklist / wmic", "tasklist took ~0.5 s per "
         "call and its polling storm distorted measured runtimes"],
        ["First failing test only", "Run all tests always", "Matches real judges, faster "
         "feedback, hides hidden-test information"],
    ], [26, 30, 44], title="Table 3.1 - Key design decisions")


def ch4():
    h1("4. Data Model")
    para("Ten tables live in data/codearena.db. Foreign keys are ON with cascading "
         "deletes; the database runs in WAL mode so readers never block the writer.")
    table(["Table", "Key columns", "Notes"], [
        ["users", "id, username (unique, NOCASE), password_hash, salt, role, banned, "
         "created_at", "role is 'user' or 'admin'"],
        ["sessions", "token (PK), user_id, created_at, expires_at", "14 day TTL; row "
         "deleted on logout or ban"],
        ["problems", "id, slug (unique), title, difficulty, tags, statement, input_spec, "
         "output_spec, constraints, time_limit_ms, memory_limit_mb, visibility, author_id",
         "statement is markdown"],
        ["test_cases", "id, problem_id, position, input, expected_output, is_sample",
         "ordered by position; CASCADE on delete"],
        ["submissions", "id, user_id, problem_id, contest_id, mode, language, source, "
         "status, verdict, message, time_ms, memory_kb, score, tests_passed, tests_total, "
         "created_at, judged_at", "status: queued/running/judged; mode: submit/sample"],
        ["submission_tests", "submission_id, position, verdict, time_ms, memory_kb, "
         "message", "one row per executed test"],
        ["contests", "id, title, description, starts_at, ends_at, visibility, created_by",
         "timestamps in epoch milliseconds"],
        ["contest_problems", "contest_id + problem_id (PK), position, score",
         "many-to-many with a point value"],
        ["contest_registrations", "contest_id + user_id (PK), registered_at",
         "who may submit inside the contest"],
    ], [17, 50, 33], title="Table 4.1 - Database tables")
    h3("Queries worth studying")
    bullets([
        "Leaderboard: three correlated subqueries per user (distinct AC problems, total "
        "attempts, sum of difficulty weights over solved problems) - a nice example of "
        "subquery-in-SELECT with a derived table and a value lookup table.",
        "Problem list: solved_count, attempt_count, solved_by_me (EXISTS), attempted_by_me "
        "(EXISTS) and the test count, all computed per row in one statement.",
        "Contest standings: raw submissions are fetched once and grouped in JavaScript so "
        "penalty math (first AC + 20 min per prior wrong attempt) stays readable instead "
        "of an unreadable recursive SQL query.",
        "Recent activity and admin charts: GROUP BY verdict / GROUP BY day with date "
        "windows in epoch milliseconds.",
    ])


def ch5():
    h1("5. The Judge Engine")
    para("The judge is the heart of the product: server/judge/judge.js plus "
         "languages.js and the small native helper memwatch.cpp.")

    h2("5.1 Judging pipeline")
    code_block(
        "enqueue(id)\n"
        "  -> drain loop (one at a time)\n"
        "     -> load submission + problem\n"
        "     -> create data/jobs/<id>/\n"
        "     -> write source file (name depends on language)\n"
        "     -> COMPILE (cpp, java)  --fail--> verdict CE\n"
        "     -> load tests (all or samples only)\n"
        "     -> for each test:\n"
        "          spawn(program)\n"
        "          stdin.write(input); stdin.end()\n"
        "          start kill timer (limit + startup allowance)\n"
        "          start memwatch.exe <pid> <limitKb>\n"
        "          collect stdout (max 1 MB) / stderr (max 64 KB)\n"
        "          on exit -> verdict for this test\n"
        "          insert submission_tests row\n"
        "          if not AC -> stop\n"
        "     -> UPDATE submission (verdict, times, memory, score)\n"
        "     -> rm -rf data/jobs/<id>/")
    h3("Queue safety")
    bullets([
        "A single 'draining' flag plus an array guarantees one submission runs at a time "
        "- no lock needed inside one Node process.",
        "If judging throws, the submission is still finalized with verdict IE so nothing "
        "stays 'running' forever.",
        "Users can have only one submission in the queue (checked at insert time).",
    ])

    h2("5.2 Language matrix")
    table(["Language", "Compile", "Run command", "Extra limits"], [
        ["C++ (g++)", "g++ -O2 -std=c++1z -o main.exe main.cpp", "main.exe", "startup "
         "allowance 0 ms"],
        ["Python 3", "none", "python -u -X utf8 main.py", "allowance 300 ms"],
        ["Java 16", "javac -encoding UTF-8 -d . Main.java (class name auto-detected from "
         "'public class X')", "java -Xmx(ML-64)m -Xss16m -cp . Main", "allowance 2000 ms, "
         "JVM OOM stderr -> MLE"],
        ["JavaScript", "none", "node --max-old-space-size=ML --stack-size=2000 main.cjs "
         "(or main.mjs if import/export is used)", "allowance 300 ms, V8 heap OOM -> MLE"],
    ], [16, 36, 30, 18], title="Table 5.1 - How each language is executed")

    h2("5.3 Output comparison rules")
    bullets([
        "Both expected and actual output are normalized: CRLF converted to LF, trailing "
        "spaces removed from every line, trailing blank lines removed.",
        "Comparison is then an exact string equality - so internal spacing and line breaks "
        "DO matter (unlike token-based judges), which is why statements must be precise.",
        "Extra blank lines at the end of your output are forgiven.",
        "A 1 MB output cap stops infinite print loops (verdict OLE).",
    ])

    h2("5.4 Memory measurement on Windows")
    para("Measuring RAM on Windows is the trickiest part of building a judge. The first "
         "implementation polled 'tasklist /FI \"PID eq X\"' every 150 ms. Benchmarking "
         "showed each call took 0.5-0.9 seconds, calls overlapped and piled up, the CPU "
         "was saturated, and short programs (100-300 ms) finished before a single sample "
         "came back - worse, the measured runtimes themselves were inflated from ~120 ms "
         "to ~900 ms, causing false TLE verdicts.")
    para("The fix was to stop shelling out to a CLI at all. server/judge/memwatch.cpp is a "
         "50-line native helper that the server compiles once with g++ -lpsapi:")
    code_block(
        "OpenProcess(pid)                 // handle stays valid after the process exits\n"
        "loop {\n"
        "    GetProcessMemoryInfo(...)     // cheap direct API call, no process scan\n"
        "    track PeakWorkingSetSize\n"
        "    if (WorkingSetSize > limit) { print peak; exit 42; }   // judge kills it\n"
        "    if (process exited) break;\n"
        "    Sleep(25);\n"
        "}\n"
        "print final peak; exit 0")
    para("Because the handle is kept open, the final peak is still readable after the "
         "program exits, so even a 100 ms submission gets an accurate memory number. "
         "The helper is built automatically at server startup (data/bin/memwatch.exe).")

    h2("5.5 Security considerations")
    bullets([
        "Passwords: scrypt with a unique 16-byte salt, constant-time comparison.",
        "Cookies: HttpOnly (JavaScript cannot read it), SameSite=Lax (limits CSRF), "
        "random 128-bit token stored server side.",
        "Authorization: requireAuth / requireAdmin middleware; hidden test outputs, "
        "source code and admin routes are all gated server side, not just in the UI.",
        "Injection: every SQL statement is parameterized (? placeholders); all HTML is "
        "escaped before rendering; statements are parsed by a custom markdown renderer "
        "that escapes first.",
        "Resource abuse: one queued submission per user, 200 KB source cap, 1 MB JSON "
        "body cap, 1 MB output cap, kill timers, memory caps.",
        "KNOWN GAP: submitted code runs with the same OS privileges as the server - a "
        "hostile submission could read the database file or delete files. Production "
        "judges execute code inside containers/VMs with dropped capabilities, no network "
        "and read-only filesystems. This is the most important thing to learn next "
        "(see chapter 10, level 5).",
    ])


def ch6():
    h1("6. REST API Reference")
    para("All endpoints return JSON. 'Auth' column: public = anyone, user = logged in, "
         "admin = role admin. Mutations use POST/PUT/DELETE; bodies are JSON.")

    table(["Method", "Path", "Auth", "Purpose"], [
        ["POST", "/api/auth/register", "public", "create account, sets session cookie"],
        ["POST", "/api/auth/login", "public", "verify password, sets cookie"],
        ["POST", "/api/auth/logout", "public", "destroy session, clear cookie"],
        ["GET", "/api/auth/me", "public", "current user or null"],
        ["GET", "/api/auth/stats", "user", "own totals: submissions / accepted / solved"],
        ["GET", "/api/problems", "public", "list with filters search, difficulty, tag"],
        ["GET", "/api/problems/tags", "public", "distinct tag list"],
        ["GET", "/api/problems/:idOrSlug", "public", "detail + sample tests (all tests "
         "for admins)"],
        ["POST", "/api/problems", "admin", "create problem"],
        ["PUT", "/api/problems/:id", "admin", "update problem"],
        ["DELETE", "/api/problems/:id", "admin", "delete problem + tests + submissions"],
        ["GET", "/api/problems/:id/tests", "admin", "all test cases incl. hidden"],
        ["POST", "/api/problems/:id/tests", "admin", "add test case"],
        ["PUT", "/api/problems/:id/tests/:testId", "admin", "edit test case"],
        ["DELETE", "/api/problems/:id/tests/:testId", "admin", "delete test case"],
        ["GET", "/api/submissions/languages", "public", "supported languages"],
        ["POST", "/api/submissions", "user", "submit code (mode submit|sample)"],
        ["GET", "/api/submissions", "public", "feed; filters mine, user, problem_id, "
         "contest_id, verdict, limit, offset"],
        ["GET", "/api/submissions/:id", "public", "detail; source and per-test rows only "
         "for owner/admin"],
        ["GET", "/api/leaderboard", "public", "ranking with score, solved, attempts"],
        ["GET", "/api/stats", "public", "site totals + 10 latest submissions"],
        ["GET", "/api/profile/:username", "public", "user stats + solved problems"],
        ["GET", "/api/contests", "public", "contests with status and problems"],
        ["POST", "/api/contests", "admin", "create contest"],
        ["GET", "/api/contests/:id", "public", "detail; problems hidden before start"],
        ["PUT", "/api/contests/:id", "admin", "update contest"],
        ["DELETE", "/api/contests/:id", "admin", "delete contest"],
        ["POST", "/api/contests/:id/register", "user", "register for contest"],
        ["DELETE", "/api/contests/:id/register", "user", "leave before start"],
        ["POST", "/api/contests/:id/problems", "admin", "attach a problem (score)"],
        ["DELETE", "/api/contests/:id/problems/:pid", "admin", "detach a problem"],
        ["GET", "/api/contests/:id/standings", "public", "ICPC style ranking"],
        ["GET", "/api/admin/stats", "admin", "dashboard data + charts + queue depth"],
        ["GET", "/api/admin/users", "admin", "all users with counts"],
        ["PUT", "/api/admin/users/:id", "admin", "set role / ban (revokes sessions)"],
        ["GET", "/api/admin/submissions", "admin", "last 100 submissions"],
        ["DELETE", "/api/admin/submissions/:id", "admin", "delete a submission"],
    ], [10, 34, 10, 46], title="Table 6.1 - Endpoint catalog (36 routes)")
    note("Error contract: every failure returns {\"error\": \"human readable message\"} "
         "with 400 (bad input), 401 (not logged in), 403 (forbidden), 404 (not found), "
         "409 (duplicate slug/username), 429 (submission already in queue) or 500.")


def ch7():
    h1("7. Frontend")
    para("The frontend is a small single page application written in vanilla JavaScript "
         "in exactly two files (public/js/app.js for everything, public/js/admin.js for "
         "the admin dashboard). There is no framework and no bundler - index.html loads "
         "both scripts, and the first one exposes a window.CA object (api helper, "
         "escapers, badges, poller registry) that the second one consumes.")

    table(["Route", "Page", "Highlights"], [
        ["#/", "Home", "Hero, four stat cards, running/upcoming contest banner, latest "
         "submissions, top-8 coders"],
        ["#/problems", "Problem list", "Search + difficulty + tag filters, solved/attempt "
         "markers, limits column"],
        ["#/problem/:id", "Problem", "Markdown statement, examples, submit editor, my "
         "submissions (auto refresh)"],
        ["#/submissions", "Submission feed", "mine/verdict/username filters, 4 s refresh"],
        ["#/submission/:id", "Submission", "Verdict, source, result panel, per-test chips, "
         "live polling while judging"],
        ["#/leaderboard", "Leaderboard", "Score/solved/attempts, own row highlighted"],
        ["#/contests, #/contest/:id", "Contests", "Status pills, countdown, register, "
         "problems and standings tabs"],
        ["#/profile/:username", "Profile", "Stats cards and solved list"],
        ["#/login, #/register", "Auth", "Client side checks, server errors toasted"],
        ["#/admin, /problems, /contests, /users, /submissions", "Admin", "Dashboard, "
         "editors and management tables (admin only)"],
    ], [30, 20, 50], title="Table 7.1 - Routes and pages")

    h3("Technical details worth copying")
    bullets([
        "Router: location.hash is split into segments, matched in a switch, each page is "
        "an async function that sets innerHTML and wires events afterwards.",
        "Poller registry: every setInterval created by a page is registered; route changes "
        "and hash changes clear them first, which prevents timers leaking between pages.",
        "The api() helper wraps fetch, injects JSON headers, throws Error(message) from "
        "the server's {error} payload, and is the single place to add future auth token "
        "handling.",
        "Escaping: a single esc() function is applied to every dynamic value before it "
        "reaches innerHTML - the most common XSS footgun in vanilla SPAs is avoided "
        "systematically.",
        "Markdown: a small renderer (same rules as the server) supports headings, lists, "
        "inline code, code fences, bold/italic and links, escaping all HTML first.",
        "Editor: gutter numbers are regenerated on input, the textarea is white-space: pre "
        "so indentation is preserved, and drafts are keyed by problem AND language.",
        "Judging UX: the submit button disables, a result card appears with a spinner and "
        "polls every 700 ms until judged, then the 'your submissions' table refreshes.",
        "Contest detection: before submitting, the client asks for the contest list and, "
        "if a running registered contest contains this problem, tags the submission so it "
        "counts toward standings.",
    ])


def ch8():
    h1("8. How the Project Was Created")
    para("The project was built bottom up: data layer, then judge, then API, then UI, "
         "then tests. Each stage was verified before moving on - the API was exercised "
         "with a scripted client before any UI existed, and the UI was verified with "
         "automated DOM tests before calling the project done.")

    h2("8.1 Build phases")
    table(["Phase", "What was built", "How it was verified"], [
        ["0. Decisions", "Chose Node.js + Express + SQLite; confirmed node:sqlite works "
         "without flags; detected available compilers (g++ 6.3, Python 3.11, JDK 16, "
         "Node 26)", "Smoke commands in the shell"],
        ["1. Data layer", "db.js: 10 tables, indexes, WAL, foreign keys; helper functions "
         "get/all/run/tx", "Interactive SQL queries"],
        ["2. Auth", "scrypt hashing, session table, cookie middleware, guards; first user "
         "becomes admin", "curl-style register/login/me round trip"],
        ["3. Judge", "languages.js command tables, judge.js (queue, compile, run, "
         "verdicts), then memwatch.cpp for memory", "Manual submissions of correct, wrong, "
         "looping and crashing programs in all four languages"],
        ["4. Seed data", "seed.js: 5 users, 8 classic problems, 71 generated tests with "
         "computed answers, 2 contests, 23 demo submissions", "Checked rows in the "
         "database"],
        ["5. API routes", "auth, problems, tests, submissions, leaderboard, contests, "
         "admin - 36 endpoints", "41 test assertions (test/api.test.mjs)"],
        ["6. Frontend", "index.html shell, styles.css theme, app.js SPA (10 pages), "
         "admin.js (5 tabs)", "30 jsdom browser tests (test/frontend.test.mjs)"],
        ["7. Hardening", "Fixed every bug in table 8.2, relaxed brittle assertions, "
         "re-seeded the database", "'npm test' green: 71 / 71"],
    ], [14, 52, 34], title="Table 8.1 - Build phases")

    h2("8.2 Bug log: problems found and fixed")
    para("Every real project is a sequence of bugs. These are the ones that actually "
         "happened while building CodeArena - they are the most valuable part of this "
         "document.")
    table(["#", "Symptom", "Root cause", "Fix", "Lesson"], [
        ["1", "Seeding crashed with FOREIGN KEY constraint failed",
         "Problems were inserted before any user existed, but problems.author_id points "
         "at users", "Create the admin user first, then problems",
         "Insert order matters when foreign keys are enabled; write migrations in "
         "dependency order"],
        ["2", "GET /api/leaderboard returned 500 'datatype mismatch'",
         "The SQL ended with 'LIMIT ?' but no parameter was passed to stmt.all()",
         "all(sql, limit)", "An unbound placeholder is a runtime error, not a syntax "
         "error - test every query through HTTP"],
        ["3", "JavaScript submissions died with 'require is not defined in ES module "
         "scope'", "The project package.json has type:module, so main.js written inside "
         "data/jobs was loaded as an ES module", "Write main.cjs (or main.mjs when the "
         "code uses import/export)",
         "Your project configuration leaks into files you write at runtime - isolate "
         "sandbox folders"],
        ["4", "Java solutions got TLE on tiny inputs",
         "JVM startup alone can exceed a 1 s limit; a fair judge gives interpreted/"
         "VM languages extra startup allowance",
         "Per-language allowance (Java +2000 ms, Python/Node +300 ms) added to the kill "
         "timer but not to the reported limit",
         "Measure real-world costs (startup, JIT) before writing a rule"],
        ["5", "ALL fast submissions reported no memory and inflated runtimes; even "
         "correct solutions started failing with TLE",
         "Polling tasklist took 0.5-0.9 s per call; the polling storm saturated the CPU "
         "and skewed the very timings being measured (120 ms looked like 900 ms)",
         "Replaced polling with a native helper (memwatch.cpp) using "
         "GetProcessMemoryInfo every 25 ms; runtimes returned to normal and MLE became "
         "reliable", "Observation must not distort the system; prefer cheap direct APIs "
         "over shelling out to CLI tools"],
        ["6", "Frontend tests failed on contest detail and stats",
         "Tests asserted exact counts (8 problems, 2 contests) although earlier runs "
         "created extra rows; also used POST for a GET endpoint and read "
         "document.textContent (always null in jsdom)",
         "Relaxed to >= assertions, corrected methods, used body.textContent; added a "
         "fresh database reset before the final run",
         "Tests must be independent of leftover state; reset fixtures before demo runs"],
        ["7", "The UI search test failed only on later runs: 12 rows instead of 1",
         "goto() set location.hash AND dispatched hashchange manually, so route() ran "
         "twice concurrently; the second render replaced the search input between the "
         "test capturing it and firing the event",
         "route() now ignores a navigation whose render is still in flight "
         "(routeSeq / inflight guard in app.js)",
         "Races stay hidden until timing shifts; make navigation idempotent and "
         "re-query elements right before interacting"],
        ["8", "npm run reset crashed: EPERM deleting the DB file, then a FOREIGN KEY "
         "error on problems",
         "Windows cannot delete a file the server has open; the table-clear fallback "
         "kept AUTOINCREMENT ids running, exposing a hard-coded author_id = 1",
         "Catch the rm failure and clear every table plus sqlite_sequence instead; "
         "reference the real admin id instead of 1",
         "Error paths that never ran are untested; never hard-code ids the database "
         "assigns"],
    ], [5, 24, 25, 24, 22], size=7.9, lh=4.4, title="Table 8.2 - Bug log")


def ch9():
    h1("9. Testing and Verification")
    para("Two suites, both plain Node scripts so they run with no test framework: "
         "'npm test' executes them in order and prints PASS/FAIL for each assertion.")
    table(["Suite", "File", "What it covers", "Count"], [
        ["API + judge", "test/api.test.mjs", "Register/login/me, problem list and detail, "
         "submissions in all four languages (AC), WA/TLE/RE/CE, sample mode, a hard LIS "
         "problem in C++, leaderboard, history, contest list/register/standings/problem "
         "hiding, auth guards (401/403), admin stats/users/problem+test CRUD/contest "
         "CRUD, end-to-end judging of a newly created problem, MLE detection",
         "41 assertions"],
        ["Browser UI", "test/frontend.test.mjs", "Boots the real site inside jsdom with a "
         "cookie-aware fetch: home, problem list + search, problem statement + samples + "
         "editor, UI login, a real submission judged AC through the interface, my "
         "submissions, feed, detail page, leaderboard, contests, standings with penalty, "
         "profile, admin overview/problems/users/contests/submissions, and zero runtime "
         "JS errors", "30 assertions"],
    ], [14, 22, 54, 10], title="Table 9.1 - Test suites")
    h3("Commands")
    code_block(
        "npm install        # install express (runtime) + jsdom (tests)\n"
        "npm run seed       # load demo data (skip if already seeded)\n"
        "npm run reset      # drop the database and seed from scratch\n"
        "npm start          # http://localhost:3000\n"
        "npm run test:api   # API + judge suite\n"
        "npm run test:ui    # browser suite (server must be running)\n"
        "npm test           # both")
    h3("What good tests look like here")
    bullets([
        "Assertions name behaviour, not implementation ('MLE detected' rather than "
        "'function X called').",
        "The judge tests submit REAL programs (correct, wrong, infinite loop, crashing, "
        "compilation error) and wait for the actual verdict - no mocking.",
        "The UI suite drives the real UI: it types into the editor, clicks Submit and "
        "waits until the verdict chip changes.",
        "The jsdom fetch wrapper implements a cookie jar, because the app depends on "
        "session cookies - tests that ignore cookies would silently pass while auth is "
        "broken.",
        "Independence proof: the full suite was run twice back to back against the same "
        "database (no reset in between) - 71/71 both times, so nothing depends on being "
        "the first run.",
        "Known trade-off: the suites are serial and mutate the same database, so they "
        "should run against a disposable database (npm run reset) - which is exactly how "
        "real integration tests must be managed.",
    ])


def ch10():
    h1("10. Learning Roadmap")
    para("This is the complete list of topics you need to master to build a project like "
         "CodeArena from scratch. Each level lists the topics, what they are used for in "
         "THIS project, and how to practise them. Levels are ordered so that each one "
         "builds on the previous; you do not need to finish one before peeking at the "
         "next. Estimates assume focused self-study.")

    h2("10.1 Level 1 - Web fundamentals (3-5 weeks)")
    h3("Topics")
    bullets([
        "HTML5: document structure, semantic elements, forms and inputs, validation "
        "attributes, accessibility basics (labels, roles).",
        "CSS: selectors, box model, cascade and specificity, flexbox, grid, custom "
        "properties (variables), transitions, responsive media queries, dark themes.",
        "JavaScript core: let/const, functions, arrays and objects, destructuring, spread, "
        "template literals, higher-order functions (map/filter/reduce), ES modules "
        "(import/export) vs classic scripts.",
        "The DOM: querySelector, createElement, textContent vs innerHTML, classList, "
        "dataset, attributes, event listeners, event delegation, document fragments.",
        "Asynchrony: the event loop, callbacks, promises, async/await, try/catch, "
        "setTimeout/setInterval/clearInterval, fetch API, JSON, error handling.",
        "Storage: localStorage/sessionStorage (used for editor drafts), cookies (what "
        "flags mean).",
        "HTTP essentials: methods (GET/POST/PUT/DELETE), status codes (200/201/400/401/"
        "403/404/409/429/500), headers, Content-Type, CORS, caching basics.",
        "Tooling: browser dev tools (Elements, Network, Console), Git basics "
        "(add/commit/log/diff/branch), a text editor or VS Code.",
    ])
    note("Practise here: rebuild the CodeArena problem list page from memory - fetch the "
         "JSON, render rows, wire a search box. Then add a theme toggle using CSS "
         "custom properties.")

    h2("10.2 Level 2 - Backend with Node.js and Express (3-5 weeks)")
    h3("Topics")
    bullets([
        "Node.js runtime: modules (ESM vs CommonJS), package.json and scripts, npm "
        "install / lock files, npx, the event loop and why blocking code stalls "
        "everything.",
        "Core modules you will need: fs, path, child_process, crypto, os, url, "
        "http/https, stream.",
        "Express: routing with parameters, middleware order, routers (express.Router()), "
        "express.json(), express.static(), custom error-handling middleware (4-argument), "
        "app.set/disable options.",
        "REST API design: resources and verbs, consistent status codes, request "
        "validation, query parameters and pagination (limit/offset), filtering, stable "
        "error envelope {\"error\": \"...\"}.",
        "Streams and buffers: piping stdin/stdout, UTF-8 handling, size caps (maxBuffer), "
        "why reading large output incrementally matters.",
        "Configuration: process.env, PORT, separating config from code, .env files.",
        "Logging: structured logs, levels, request logging, reading stack traces.",
        "Cross-platform details: path separators, spawning .exe on Windows, "
        "windowsHide, executable search through PATH.",
    ])
    note("Practise here: build a JSON file API for a todo list (GET/POST/PUT/DELETE) with "
         "validation and proper status codes, then write 10 curl/fetch tests for it.")

    h2("10.3 Level 3 - Databases and SQL (3-4 weeks)")
    h3("Topics")
    bullets([
        "Relational modelling: entities, primary/foreign keys, one-to-many and "
        "many-to-many (see contest_problems), NOT NULL, UNIQUE, DEFAULT, CASCADE rules.",
        "SQL: SELECT with WHERE/LIKE, ORDER BY, LIMIT/OFFSET, aggregates and GROUP BY, "
        "all JOIN types, subqueries (scalar and in FROM), correlated subqueries and "
        "EXISTS - every leaderboard query here uses them.",
        "Indexes: why (COUNT/EXISTS on submissions needs them), composite indexes, when "
        "they slow writes.",
        "SQLite specifics: file based database, WAL journal mode, PRAGMA foreign_keys, "
        "type affinity, AUTOINCREMENT rowid, transactions BEGIN/COMMIT/ROLLBACK and why "
        "the project wraps writes in tx().",
        "Data types in practice: storing timestamps as epoch milliseconds, booleans as 0/1, "
        "JSON as TEXT when needed.",
        "Schema evolution: creating tables with IF NOT EXISTS, adding seed/reset scripts, "
        "why you design a schema before writing routes.",
        "Moving up: connection pools, PostgreSQL differences (types, sequences, upsert), "
        "when SQLite stops being enough.",
    ])
    note("Practise here: draw the CodeArena ER diagram on paper, then write the five "
         "hardest queries from scratch: leaderboard with score, problem stats with "
         "solved_by_me, contest standings input, verdict distribution, 14-day chart data.")

    h2("10.4 Level 4 - Security (2-4 weeks)")
    h3("Topics")
    bullets([
        "Password storage: hashing vs encryption, salts, why fast hashes (MD5/SHA) are "
        "wrong, key derivation functions (scrypt, bcrypt, Argon2), cost factors.",
        "Constant-time comparison (timingSafeEqual) and side channels.",
        "Session management: server-side sessions vs JWT, cookie flags (HttpOnly, "
        "Secure, SameSite), token entropy, expiry, revocation on ban/logout.",
        "Threats: XSS (escaping output, CSP), CSRF (SameSite, tokens), SQL injection "
        "(parameterized queries - always), broken access control (checking roles on the "
        "SERVER for every route), IDOR (owning objects before revealing them).",
        "Input validation: allow-lists, length limits, type coercion, rejecting unknown "
        "fields, validating on both sides.",
        "Abuse prevention: rate limiting, one-in-flight rules, payload size caps, output "
        "caps - all present in this project.",
        "The OWASP Top 10 as a checklist; secrets handling and what never to commit.",
        "Safe code execution (the topic a judge MUST eventually learn): OS sandboxing - "
        "containers, namespaces/cgroups, seccomp, capability dropping, rlimits / ulimit, "
        "Windows Job Objects, read-only filesystems, no network, CPU and process quotas, "
        "fork bombs, and why running user code as a normal user is dangerous.",
    ])
    note("Practise here: read server/auth.js and every requireAuth/requireAdmin call, then "
         "write a short threat model for CodeArena: what could a malicious logged-in user "
         "do today? What breaks if you remove one guard?")

    h2("10.5 Level 5 - Operating systems and process control (3-5 weeks)")
    h3("Topics")
    bullets([
        "Processes vs threads, PIDs, parent/child relationships, exit codes and signals, "
        "zombie processes.",
        "Node child_process: spawn vs exec vs execFile vs fork; stdio configuration "
        "(['pipe','pipe','pipe']); the difference between 'exit' and 'close' events; why "
        "spawn is the right choice for a judge (no shell, no buffer limits, direct pipes).",
        "I/O plumbing: writing to a child's stdin and closing it, accumulating stdout/"
        "stderr, backpressure, output size caps, deadlocks when nobody reads a pipe.",
        "Timing: wall-clock vs CPU time, high-resolution timers (process.hrtime.bigint), "
        "timeouts and clean kills, why kill(TERMINATE) can leave orphaned grandchildren.",
        "Memory: resident set size vs virtual size, peak working set, heap vs RSS, "
        "measuring on Windows (GetProcessMemoryInfo / PSAPI) and Linux "
        "(/proc/[pid]/status, getrusage), memory limits per runtime (-Xmx, "
        "--max-old-space-size).",
        "Compilers and runtimes: g++ flags (-O2, -std), javac/java class paths and public "
         "class naming rules, CPython startup, Node flags; diagnosing 'command not found'.",
        "A real performance investigation: how the tasklist polling storm was found with "
        "a micro-benchmark and replaced by a native helper (see 5.4 / bug 5).",
        "Next step in sandboxing: Docker-based judging, gVisor/Firecracker, Linux cgroups, "
        "ulimit, or Windows Job Objects with memory/CPU quotas.",
    ])
    note("Practise here: write a tiny 'timeit' CLI that runs any program, feeds it stdin, "
         "kills it after N ms and reports time, exit code and peak memory - that is 80% of "
         "a real judge.")

    h2("10.6 Level 6 - Algorithms and problem solving (8-16 weeks, ongoing)")
    h3("Topics")
    bullets([
        "Complexity analysis: Big-O/Big-Theta, amortised analysis, constants and why "
        "O(n^2) dies at n = 200000 (the seed data proves it).",
        "Data structures: arrays/strings, hash maps and sets, stacks, queues, deques, "
        "linked lists, binary trees, heaps/priority queues, tries, union-find, graphs as "
        "adjacency lists.",
        "Core techniques: sorting and custom comparators, binary search (on arrays and on "
         "the answer), two pointers, sliding window, prefix sums, greedy algorithms, "
        "recursion and backtracking.",
        "Dynamic programming: memoisation, tabulation, Kadane's algorithm, LIS in O(n log n), "
        "coin change, knapsack - four of the eight seeded problems are DP.",
        "Graphs: BFS/DFS, topological sort, Dijkstra, shortest path on unweighted graphs.",
        "Number theory and strings basics: modular arithmetic, hashing, common string "
        "algorithms.",
        "Competitive skills that judges rely on: fast input reading, 64-bit integers, "
        "off-by-one discipline, handling negative numbers and all-equal edge cases.",
        "Test design: generating deterministic random tests, choosing adversarial cases "
        "(all negatives, already sorted, maximum size), writing correct reference "
        "solutions to produce expected output - exactly how seed.js builds its 71 tests.",
    ])
    note("Practise here: implement every seeded problem in two different ways, prove the "
         "complexity, then craft a test that breaks the naive version.")

    h2("10.7 Level 7 - Software engineering practice (2-4 weeks)")
    bullets([
        "Version control with Git: commit hygiene, branches, reviewing your own diff, "
        "writing a meaningful commit message, .gitignore (node_modules, data/*.db).",
        "Code organisation: separation of concerns (routes vs domain logic vs storage), "
        "small modules with one job, avoiding a 3000-line 'server.js'.",
        "Error handling strategy: fail fast, meaningful messages, never leak internals to "
        "clients, distinguish 4xx from 5xx.",
        "Configuration and environments (dev/test/prod), feature flags, seed vs production "
        "data.",
        "Observability: logging, metrics (queue depth, verdict distribution), health "
        "checks, alerting ideas.",
        "API lifecycle: versioning, backward compatibility, deprecation, documenting your "
        "endpoints (chapter 6 was written this way).",
        "Performance thinking: N+1 queries, indexes, pagination, caching layers, "
        "when to move the judge to a queue + workers.",
        "Collaboration basics: code review checklist, writing docs (this PDF), estimating "
        "and slicing work into phases like table 8.1.",
    ])

    h2("10.8 Level 8 - Testing and quality (2-3 weeks)")
    bullets([
        "The test pyramid: unit tests for pure logic (output comparison, penalty math, "
        "slugify), integration tests for API routes, end-to-end tests for the UI.",
        "Test structure: arrange/act/assert, one behaviour per test, descriptive names.",
        "Tools: node:test or Vitest/Jest for assertions and structure, supertest for HTTP, "
        "Playwright/Cypress for real-browser E2E (jsdom covers a lot with zero setup).",
        "Fixtures and isolation: fresh database per run, deterministic seeds, cleaning up "
        "after tests (the reset flow used here).",
        "Non-functional tests: timeouts, output caps, malformed JSON, unauthorized access "
        "(the 401/403 assertions), concurrent submissions.",
        "Debugging failing tests: read the failure message first, reproduce minimally, fix "
        "the cause not the assertion (unless the assertion was wrong - bug 6).",
        "Coverage as a hint not a goal; regression tests: every bug in table 8.2 should "
        "become a test.",
    ])

    h2("10.9 Level 9 - Deployment and scaling (3-4 weeks, after the rest)")
    bullets([
        "Linux administration: shell basics, systemd services, file permissions, logs, "
        "SSH, cron.",
        "Serving a Node app: process managers (pm2 or systemd), Nginx as reverse proxy, "
        "HTTPS certificates, WebSocket proxying.",
        "Containers: writing a Dockerfile for the app, a separate judge container image "
        "with all four toolchains, docker compose for app + database.",
        "CI/CD: GitHub Actions running 'npm test' on every push, linting (ESLint), "
        "automatic deploys.",
        "Data operations: SQLite backups (file copy in WAL mode / .backup), migrations, "
        "monitoring disk usage.",
        "Scaling out: moving the judge queue to Redis/BullMQ with worker processes, "
        "PostgreSQL for concurrent writes, load balancers, rate limiting at the edge.",
        "Reliability: graceful shutdown (finish the current submission), retries, idempotency, "
        "disaster recovery.",
    ])

    h2("10.10 Suggested study order")
    table(["Stage", "Focus", "Weeks", "Milestone you can demo"], [
        ["1", "Level 1 web fundamentals", "3-5", "Static page with a form that fetches "
         "JSON and renders it, styled responsively"],
        ["2", "Level 2 backend", "3-5", "Express REST API with validation, tested with "
         "fetch scripts"],
        ["3", "Level 3 SQL", "3-4", "Normalized schema for problems/tests/submissions + "
         "aggregation queries"],
        ["4", "Level 8 testing (basic)", "1-2", "10 automated API tests you can re-run "
         "any time"],
        ["5", "Level 4 security", "2-4", "Login with hashed passwords, sessions, role "
         "guards, passing your own attack checklist"],
        ["6", "Level 5 processes", "3-5", "A working 'run program with limits' CLI - the "
         "core of the judge"],
        ["7", "Level 6 algorithms", "ongoing", "Solve 100+ problems; write 3 judge "
         "problems with generated tests"],
        ["8", "Level 7 + 8 (deep)", "2-4", "Refactored, documented, well-tested project "
         "with a green 'npm test'"],
        ["9", "Level 9 deployment", "3-4", "Live URL with HTTPS, containerized judge and "
         "CI pipeline"],
    ], [8, 34, 12, 46], title="Table 10.1 - A realistic 4-6 month path (part-time)")
    para("Total: roughly 20-35 weeks of consistent part-time study to be able to design "
         "and build this entire system independently - and to understand every line of "
         "the 4 500+ lines of code in this repository.", color=MUTED)


def ch11():
    h1("11. Ideas to Extend the Project")
    table(["Feature", "What to build", "Topics it teaches"], [
        ["Docker sandbox", "Run every submission in a disposable container with CPU, "
         "memory, pids and network limits", "Containers, namespaces/cgroups, security"],
        ["Rejudge button", "Re-run all submissions for a problem after fixing tests",
         "Queues, idempotency, batch jobs"],
        ["Custom checkers / validators", "Special programs that compare output (ignore "
         "order, floating point tolerance)", "Plugin design, exit codes as protocol"],
        ["WebSockets live standings", "Push verdicts and standings instantly instead of "
         "polling", "WebSockets, fan-out, state sync"],
        ["Multi-worker judge", "Move judging to child processes or a Redis queue",
         "Concurrency, IPC, shared state"],
        ["Plagiarism detection", "Compare submissions with normalized token streams",
         "Hashing, similarity metrics, winnowing"],
        ["Problem discuss/ editorial", "Markdown comments and official solutions after "
         "the contest", "Content model, moderation"],
        ["OAuth / email", "Login with Google/GitHub, email verification, password reset",
         "OAuth2 flows, token security, SMTP"],
        ["Rating system (Elo/Glicko)", "Rating changes after contests", "Probability "
         "models, rating maths"],
        ["Public API + tokens", "Personal access tokens for CLI submissions",
         "API key auth, scopes, quotas"],
        ["Rich editor", "Syntax highlighting (CodeMirror/Monaco), autocomplete, run on "
         "your own samples", "Editor integration, iframe/worker security"],
        ["Analytics", "Per-problem difficulty from AC rates, heatmaps of activity",
         "Aggregation queries, charts"],
    ], [24, 46, 30], title="Table 11.1 - Feature backlog")


def ch12():
    h1("12. Appendix: Commands, Accounts, File Map")

    h3("Quick start")
    code_block(
        "cd codearena\n"
        "npm install              # once\n"
        "npm run seed             # demo data\n"
        "npm start                # http://localhost:3000\n"
        "npm test                 # 71 checks (server must be running)\n"
        "npm run reset            # wipe + re-seed (works even with the server up)\n"
        "python tools/make_project_pdf.py   # regenerate this document")

    h3("Default accounts")
    table(["Username", "Password", "Role", "Seeded state"], [
        ["admin", "admin123", "admin", "Owns all problems and contests"],
        ["alice", "password123", "user", "5 solved, contest leader"],
        ["bob", "password123", "user", "3 solved, has WA attempts"],
        ["carol", "password123", "user", "2 solved"],
        ["dave", "password123", "user", "1 solved + 1 runtime error"],
    ], [18, 20, 14, 48])

    h3("Seeded problem set (8 problems, 71 tests)")
    table(["Slug", "Difficulty", "Tags", "Idea"], [
        ["sum-of-two", "easy", "math", "A + B warm-up, 64-bit sums"],
        ["fizzbuzz-range", "easy", "implementation", "1..N with Fizz/Buzz, N up to 1000"],
        ["reverse-the-line", "easy", "strings", "Reverse a whole line, 5000 chars"],
        ["fibonacci-number", "easy", "math/DP", "F(n) for n up to 90 (bigint)"],
        ["count-occurrences", "medium", "binary search", "Sorted array, n = 200000"],
        ["maximum-subarray", "medium", "DP", "Kadane with all-negative edge case"],
        ["longest-increasing-subsequence", "hard", "DP/binary search", "O(n log n) or "
         "TLE at n = 100000"],
        ["coin-change", "hard", "DP", "Unbounded knapsack, greedy fails"],
    ], [30, 14, 22, 34])

    h3("Verdict cheat sheet")
    code_block(
        "AC  all tests match after whitespace normalisation\n"
        "WA  output mismatch           -> check logic; samples show expected vs actual\n"
        "TLE killed at limit+allowance -> improve complexity, remove debug prints\n"
        "MLE peak RSS over limit       -> shrink arrays, avoid deep recursion copies\n"
        "RE  non-zero exit / crash     -> read the stderr shown on the detail page\n"
        "CE  compiler rejected code    -> read the compiler output block\n"
        "OLE more than 1 MB of output  -> remove print statements inside loops\n"
        "IE  judge-side failure        -> report it; tests may be missing")

    h3("File map - where to look for a feature")
    table(["To change...", "Open..."], [
        ["Password rules or session length", "server/auth.js"],
        ["A new API endpoint", "server/routes/*.js (register in server/index.js)"],
        ["Verdict logic or limits", "server/judge/judge.js"],
        ["Compile/run commands for a language", "server/judge/languages.js"],
        ["Memory measurement", "server/judge/memwatch.cpp"],
        ["Schema / new column", "server/db.js + server/seed.js"],
        ["A new page or widget", "public/js/app.js (register a route in route())"],
        ["Admin screen", "public/js/admin.js"],
        ["Look and feel", "public/styles.css"],
        ["Demo data", "server/seed.js"],
        ["Automated checks", "test/api.test.mjs, test/frontend.test.mjs"],
        ["This PDF", "tools/make_project_pdf.py"],
    ], [46, 54])

    gap(6)
    note("End of document. Generated by tools/make_project_pdf.py - edit that file and "
         "re-run it whenever the project changes.")



def build():
    global pdf
    for pass_no in (1, 2):
        if pass_no == 1:
            PAGES.clear()
        pdf = Guide(format="A4", unit="mm")
        pdf.set_margins(18, 16, 18)
        pdf.set_auto_page_break(True, margin=16)
        pdf.alias_nb_pages()
        pdf.set_title("CodeArena - Online Coding Judge: Project Guide")
        pdf.set_author("CodeArena")
        pdf.set_creator("CodeArena project documentation generator")

        pdf.add_page()
        cover()
        pdf.add_page()
        toc_page()

        pdf.add_page()
        ch1(); ch2(); ch3(); ch4(); ch5(); ch6()
        ch7(); ch8(); ch9(); ch10(); ch11(); ch12()

        if pass_no == 2:
            pdf.output(OUT)
            print("Wrote %s (%d pages)" % (OUT, pdf.pages_count))


if __name__ == "__main__":
    build()
