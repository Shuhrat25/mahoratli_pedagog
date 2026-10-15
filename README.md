# Mahoratli pedagog

[Открыть демо](https://mahoratli-pedagog.vercel.app/)

**Mahoratli pedagog** ("Skilled educator") is a learning platform for future primary-school
teachers. It combines a blog-style news feed, structured lessons with auto-graded tests,
assignments with file submissions, and a forum — for two roles: **teacher/admin** and
**student**.

The app's interface is in Uzbek (Latin script), built around a national-values curriculum
(folk tales turned into comics, quotes from Central Asian scholars, etc.).

## Features

**Guest**
- Public landing page with a banner carousel, feature highlights, and a preview of
  featured content

**Student**
- Home feed: banners (optionally with a background image), teacher posts (like/comment),
  and live-updating polls
- Home feed with search, tag filtering and pagination
- Lessons: topics → lessons (video / text / test / **live** / **puzzle**), unlocked sequentially —
  **enforced server-side**, not just hidden in the UI. A test lesson only unlocks the next
  one once its pass mark is reached
- Live lessons: an external meeting link (Zoom / Meet) with a start time; the join button
  opens 15 minutes beforehand and every student gets a notification when one is scheduled
- Jigsaw puzzle lessons: pick one of the teacher's photos and a difficulty (Oson ~12,
  O'rta ~24, Qiyin ~48, Mutaxassis ~80 pieces), then drag real jigsaw-shaped pieces into
  the frame with a mouse or finger. Best time per photo and difficulty is kept, and it works
  on phones (the frame sits above the pieces). Puzzles are **optional** — they never block
  the next lesson and don't count towards completion or the certificate
- Downloadable per-lesson attachments (slides, PDFs, worksheets)
- Optional test timer, shuffled questions and attempt limits — on **lessons and
  assignments alike**. Leaving a field empty means no limit: unlimited time, unlimited
  attempts. When a timer is set, the countdown ends the test: answers are submitted
  automatically and the student is taken out of the test, keeping whatever they had marked
- Multiple-correct-answer questions: a question with several `~` lines becomes a checkbox
  question, and it only counts as correct when every right answer is ticked and no wrong one is
- Certificate page once every lesson is complete (print / save as PDF)
- Auto-graded tests, including bulk import from a DOCX/PDF/TXT file using a simple markup
  format (`~` correct answer, `==` incorrect answer, `++++` question separator)
- In-app notifications (new assignment, grade received, deadline in under 24h, forum reply,
  new post, scheduled live lesson) delivered instantly over WebSocket
- Assignments: a dedicated submission page where several files can be attached at once
  (each up to 10 MB, so a large piece of work can be split) plus an optional note to the
  teacher; grading and comments come back on the assignment page
- Downloadable materials
- Forum (create threads, reply)
- Profile with light/dark theme

**Teacher / Admin**
- Dashboard: student count, live online count (via WebSocket presence), open assignments,
  ungraded submissions, and a **real** 30-day visits chart (daily unique users)
- Student progress board: who is on which lesson, completion %, average test score
- Participants management (create/edit/delete, role-based restrictions — see below)
- Blog management: banners, posts and polls. Posts support drafts, scheduled publishing,
  tags, pinning to the top of the feed, a cover image, reading time, and a public
  permalink at `/post/<id>` that is server-rendered with Open Graph tags so the link
  previews correctly when shared
- Polls can be turned into quizzes — correct answers are revealed after voting. With
  "several answers allowed" on, several options can be marked correct (the picker switches
  from radio buttons to checkboxes)
- Lessons/topics management with drag-style reordering and the DOCX/PDF test importer
- Puzzle lessons: upload as many photos per lesson as needed (drag & drop, resized to
  1600 px in the browser before upload), optional points per photo (empty = no points),
  and a "Sinab ko'rish" preview that plays the puzzle exactly as students see it
- **Rich text everywhere the teacher writes** — a dependency-free WYSIWYG editor
  (headings, lists, quotes, code blocks, colours/highlight, alignment, links, inline
  images, fullscreen) on banners, posts, lesson content, assignment descriptions,
  grading comments and the forum.
- Assignment creation and grading (grades feed into a student point/rating system)
- Grade export to CSV (opens directly in Excel)
- Materials management (batch upload)
- Forum moderation

**Role rules** (per the client's spec): the main **teacher** account is the only one that
can create, promote, or delete other **teacher** accounts; **admins** act as moderators and
cannot touch teacher accounts.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Backend | Node.js, Express, Prisma ORM |
| Database | PostgreSQL (current schema and checked-in migrations) |
| Auth | JWT in an httpOnly cookie |
| Realtime | WebSocket (`ws`) for online/offline presence |
| File uploads | Multer, served through a permission-checked download route |
| Email | Resend (registration / password-reset verification codes) |
| DOCX/PDF parsing | `mammoth`, `pdf-parse` |
| Rich text | Custom `contentEditable` editor + HTML allowlist sanitiser (no external editor library) |

## Project structure

```
mahoratli_pedagog/
├── app/                 # Next.js pages (App Router)
│   ├── (guest)/         # Landing, login, register, forgot-password
│   ├── student/         # Student cabinet
│   └── teacher/         # Teacher/admin cabinet
├── components/          # Shared React components
├── lib/                 # API client, auth context, static content
├── server/              # Express + Prisma backend (separate service)
│   ├── prisma/          # Schema, migrations, seed script
│   ├── src/
│   │   ├── routes/      # REST endpoints
│   │   ├── middleware/  # Auth, file upload
│   │   ├── lib/         # JWT, password hashing, mailer, test-markup parser...
│   │   └── ws.js        # WebSocket presence server
│   └── uploads/         # Uploaded files (gitignored)
└── public/
```

## Getting started

### Prerequisites
- Node.js 18+
- npm

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # set DATABASE_URL for PostgreSQL and JWT_SECRET
npx prisma migrate deploy
npm run seed
npm run dev
```

The API runs at `http://localhost:4000`.

### 2. Frontend

In a second terminal, from the project root:

```bash
npm install
```

Create `.env.local` (see [Environment variables](#environment-variables) below):

```
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
```

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

### Demo accounts (after seeding)

| Role | Login | Password |
|---|---|---|
| Teacher | `teacher` | `teacher123` |
| Admin | `admin` | `admin123` |
| Student | `student` | `student123` |

## Environment variables

**`server/.env`**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the current Prisma provider |
| `JWT_SECRET` | Secret used to sign auth cookies |
| `PORT` | API port (default `4000`) |
| `CLIENT_ORIGIN` | Comma-separated list of allowed frontend origins for CORS, no trailing slash (e.g. `http://localhost:3000,https://your-app.vercel.app`) |
| `NODE_ENV` | `development` or `production` — also controls cross-site cookie settings |
| `RESEND_API_KEY` | Resend API key for sending verification emails |
| `EMAIL_FROM` | Sender address (must be on a domain verified in Resend) |
| `EMAIL_SENDING_ENABLED` | `"true"` to actually send emails; otherwise verification emails cannot be sent; current auth routes do not return verification codes to the client |

**`.env.local`** (frontend root)

| Variable | Description |
|---|---|
| `BACKEND_URL` | Backend origin, **no `/api` suffix, no trailing slash** (e.g. `http://localhost:4000` or `https://your-api.onrender.com`). Server-side only — used by the `/api/*` rewrite proxy in `next.config.js`, never sent to the browser. |
| `NEXT_PUBLIC_WS_URL` | Full WebSocket URL for the online-presence connection (e.g. `ws://localhost:4000/ws` or `wss://your-api.onrender.com/ws`) |
| `NEXT_PUBLIC_SITE_URL` | Public origin of the frontend (e.g. `https://mahoratli-pedagog.vercel.app`). Used to build absolute Open Graph image URLs for shared post links. Optional locally; **set it in production**, otherwise link previews have no image. |

### Why a proxy, not a direct API URL

The frontend never calls the backend's domain directly for REST requests — `next.config.js`
rewrites `/api/*` to `BACKEND_URL` **server-side**, so the browser only ever talks to its own
origin. This matters because the frontend (Vercel) and backend (Render) live on different
domains: a direct cross-origin call makes the auth cookie a *third-party cookie*, which
Safari blocks by default and Chrome increasingly does too — login would appear to succeed
(the response comes back fine) but silently fail to persist on reload. Routing through the
same-origin proxy makes the cookie first-party regardless of where the backend actually
lives.

The one exception is the WebSocket (presence) connection, which can't be proxied this way
(Vercel doesn't support relaying long-lived WS upgrades to an external server) — it connects
to the backend directly via `NEXT_PUBLIC_WS_URL`. If a browser blocks that as third-party,
only the online/offline indicator degrades; login and everything else keeps working through
the proxy.

## Deployment

- **Frontend → Vercel**: import the repo. In the project's environment variables (dashboard —
  `.env.local` is gitignored and never reaches the build), set `BACKEND_URL` (no `/api`) and
  `NEXT_PUBLIC_WS_URL` to the deployed backend. **Remove any old `NEXT_PUBLIC_API_URL`** if
  you set one previously — it overrides the proxy default and reintroduces the third-party
  cookie bug. Redeploy after changing env vars; `NEXT_PUBLIC_*` values are baked in at build
  time, so restarting isn't enough.
- **Backend → Render** (or any Node host): root directory `server/`, build command
  `npm install && npx prisma migrate deploy`, start command `npm start`. `migrate deploy`
  applies any pending migration on every deploy, including the blog / live-lesson /
  notifications one. Set the server env
  vars above, with `NODE_ENV=production` and `CLIENT_ORIGIN` set to your Vercel URL
  (comma-separated with `http://localhost:3000` too if you want local dev to also reach this
  deployed backend directly for testing).

> **Managed Postgres + `prisma migrate dev` don't mix well:** most hosted free-tier Postgres
> (Render included) doesn't grant the SUPERUSER rights `migrate dev`'s shadow-database step
> needs, so it fails with a permissions error. To generate a migration against one, use
> `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
> to get the raw SQL, save it under `prisma/migrations/<timestamp>_name/migration.sql`
> yourself, and apply it with `npx prisma migrate deploy` (which doesn't need a shadow
> database). Also keep `prisma/migrations/migration_lock.toml` in sync with the schema's
> `provider` — a mismatch fails the next `migrate deploy` with error `P3019`.

> **Database provider:** the current project uses PostgreSQL and PostgreSQL migrations. An old SQLite setup is not compatible without deliberate schema and migration changes.

## Rich text and HTML safety

Teacher/admin text fields store **HTML**, produced by `components/RichTextEditor.jsx`
(zero dependencies, built on `contentEditable`). Older records are still plain text —
`components/RichText.jsx` detects which is which, so no data migration was needed.

**Where students get it too:** the **forum** — and only the forum. Students ask questions
there that need lists, quotes, links and screenshots, so both creating a thread and
replying use the editor. Everywhere else a student types (post comments, profile) stays a
plain input.

**Images** are uploaded through `POST /api/files/inline` by the toolbar button, by pasting
a screenshot, or by dropping a file into the editor, and are embedded as
`<img src="/api/files/<id>">`. Size limits follow the same per-role rule as every other
upload. Such a file is attached to no table, so `GET /api/files/:id` treats any image that
is not someone's submission as readable by any signed-in user — which is exactly what an
image embedded in shared content needs. The public post page rewrites those URLs to
`/api/files/public/<id>`, which serves an image only when it appears in a published post
or banner, so guests and link-preview bots can see it without an account.

HTML is sanitised **twice**, against a tag/attribute allowlist:

- **Server** (`server/src/lib/sanitizeHtml.js`) before every write — this is the one that
  matters, because the API can be called directly, bypassing the browser.
- **Client** (`lib/richText.js`) on paste and again on render, which also cleans up
  records written before the sanitiser existed.

`<script>`, `<iframe>`, every `on*` handler, `javascript:` URLs and CSS `url()` are
stripped; surviving `<a>` tags get `target="_blank" rel="noopener noreferrer nofollow"`.

## Test timing

The countdown is **not** a client-side convenience. `POST /…/start-test` records when the
attempt began and returns only the end time, so the browser computes the remaining seconds
from it — reloading the page, or closing and reopening the tab, does not hand out more time.

On submit the server rejects anything that arrives after the window (plus a 15-second
allowance for network latency) and marks the attempt as used, so an abandoned test cannot
be resumed later. If nothing was submitted at all, the attempt is recorded as 0.

A test with no time limit has no end time, no countdown and no expiry — exactly the
"solve it freely" case.

## Puzzle lessons

- **Shapes** — `lib/jigsaw.js` builds every inner edge once as three cubic Béziers with a
  little random jitter; the two neighbouring pieces use the *same* points (one reversed),
  so they fit exactly. Border edges are straight. The grid is chosen per photo so pieces
  stay close to square (`gridFor`).
- **Board** — one SVG; each piece is the photo clipped by its outline. While dragging,
  only that piece's `transform` attribute is updated (no React re-render), so 80 pieces
  stay smooth. A piece dropped within 30% of its size from its cell snaps in and locks.
- **Unlocking** — `PUZZLE` is an *optional* lesson type (`OPTIONAL_LESSON_TYPES`). It opens
  like any lesson once the previous required lesson is done, but it never locks what
  follows, and topic completion, progress % and the certificate only count required lessons.
- **Scoring** — `POST /api/puzzles/:imageId/start` records the start time;
  `/solve` computes the time on the server, refuses impossibly fast results (0.4 s per
  piece, at least 5 s), counts each start once, and awards the lesson's points only the
  **first** time a student completes a given photo (at any difficulty). Teachers and admins
  can play but never receive points or lesson progress.

## Uploads, rate limiting and other guardrails

- **Upload size**: students are capped at **10 MB** *per file* — a submission can carry up
  to 10 files, so the cap never blocks a large piece of work — and to a list of document /
  image / audio / video / archive types. Teachers and admins have **no size limit** (they
  upload large course material) and only executable file types are blocked. The two limits
  are two `multer` instances picked per request by role — see `server/src/middleware/upload.js`.
- **Rate limiting**: `/auth/login`, `/auth/send-code`, `/auth/verify-code` and registration
  are throttled in memory (`server/src/lib/rateLimit.js`). Password reset never reveals
  whether an email is registered.
- **Passwords** must be at least 8 characters with a letter and a digit — enforced on the
  server, mirrored in the UI with a strength meter.
- **Errors**: Prisma failures are mapped to real HTTP statuses (404 / 409 / 400) instead of
  a blanket 500 — see `server/src/lib/httpError.js`.
- **Presence** survives restarts: it combines open WebSockets with a `User.lastSeenAt`
  column, and a ping/pong heartbeat drops connections that died behind a proxy.

## Tests

```bash
cd server
npm test
```

Runs on the built-in Node test runner (no test framework dependency). Covers the HTML
sanitiser against an XSS attack corpus — **both** the server and the browser
implementation, asserting they agree — the lesson-unlocking rules (including optional puzzle lessons), puzzle geometry (shared edges
match exactly, difficulty lists agree between server and browser), the test-markup parser,
CSV escaping, password rules, Prisma error mapping and the rate limiter.

## Known limitations

- Email sending is feature-flagged off by default (`EMAIL_SENDING_ENABLED=false`) until a
  custom domain is verified with Resend. Registration and reset require working email delivery; verification codes are not returned to the browser.
- Open-ended (free-text) test questions are not supported — tests are multiple choice
  only. Adding them needs answer storage plus a manual grading flow, i.e. its own feature.
- Rate limiting and WebSocket presence are per-process. On a single instance (Render free
  tier) that is correct; scaling to several instances would need Redis.


### Security and grade integrity (October 2026)

- Test submissions require an active server-side attempt, including unlimited tests. Replays are rejected; expired attempts are consumed atomically.
- A PostgreSQL account-row lock serializes test starts, submissions, grading, puzzle rewards and student upload quota checks. Submission.creditedPoints tracks each work's contribution: resubmitting removes the old contribution, and regrading applies only the difference.
- GradeAudit records the actor, student, target and old/new grade values. Staff can view Baholar tarixi on the assignment page or GET /api/assignments/audit. History starts after this migration; old changes cannot be reconstructed.
- File access checks published posts, forum ownership and unlocked lessons. Exact image references preserve existing rich text; arbitrary IDs in text do not grant access. Existing linked files are retained.
- Reset/registration confirmations are one-use DB-backed tokens. Verification codes are never returned by the API or logged when mail fails; registration/reset need a working mail service.
- Legacy unversioned cookies are rejected. Password/role changes and forced logout revoke sessions; sockets are closed immediately on this instance and checked every 30 seconds on other instances. Users with old cookies must sign in again.
- Student uploads remain 10 MiB per file, at most 10 files per submission. Uploads are limited to 20 requests/hour/account and 500 MiB stored/account by default (STUDENT_UPLOAD_QUOTA_MB). The quota is checked atomically. Teacher/admin file size remains unlimited. Failed uploads are cleaned up; unattached student files older than seven days are swept daily. Limits based on memory apply per API process.
- Puzzle sessions record server-issued pieces and validate placements before accepting completion. A simple start/wait/solve request no longer earns points. This is not proof of human interaction: automated solvers remain possible. Rewards are once per image across all difficulties.
- Apply server/prisma/migrations/20261006090000_security_integrity before deploying the new API; generate Prisma Client afterward. Existing scores and total points are preserved. The migration initializes contributions from current reviewed scores; it cannot infer historical overcounting or teacher-adjusted puzzle rewards.

#### Backups

From server/, run npm run backup with PostgreSQL client tools available (pg_dump or PG_DUMP_PATH). It saves a custom-format database dump and a copy of uploads/ in server/backups/<timestamp>; this directory is ignored by Git. pg_dump must support the server's PostgreSQL version. Credentials are passed through environment variables, never command arguments. For a consistent database/files snapshot, pause writes during the backup. Keep an encrypted off-host copy with restricted access and test recovery in an isolated database using pg_restore plus the uploads directory. Do not run seed against a working database to restore data.

This command does not configure scheduled hosting backups. Configure retention, off-host storage and the hosting provider's automated backup policy before public launch; Render ephemeral uploads still require persistent storage. A backup on the same host alone does not protect against host loss.

## Basic application security

Implemented protections include server-side role and ownership checks, password hashing, httpOnly auth cookies, session revocation using `tokenVersion`, and WebSocket session/origin checks. Login, registration, email verification and student uploads have rate limits. Rich text is sanitized on the server; uploads have extension, size and student quota checks and permission-checked downloads. CSV export escapes spreadsheet formula prefixes.

Tests and grading use server-side timing/attempt checks, transactions, one-time submission rules and an audit trail for grade changes. Verification tokens are purpose-bound and consumed once. These are basic application-hardening measures, not a claim of complete protection or an independent penetration test. The rate limiter is held in one process's memory.

Security and regression tests: `cd server && npm test` (run from a full checkout, since tests also import frontend helpers from `lib/`).

### Disposable hosted demo

The public deployment uses a disposable demo database. On a fresh demo database only, `DEMO_SEED=true` enables `node scripts/seed-if-empty.js` after migrations; it skips seeding if users already exist. Do not run the original destructive seed against a database with needed data. Free Render database/storage limits make this deployment suitable for demonstrations; persistent production hosting is a separate setup.
