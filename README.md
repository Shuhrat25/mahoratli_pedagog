# Mahoratli pedagog

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
- Lessons: topics → lessons (video / text / test), unlocked sequentially — **enforced
  server-side**, not just hidden in the UI
- Auto-graded tests, including bulk import from a DOCX/PDF/TXT file using a simple markup
  format (`~` correct answer, `==` incorrect answer, `++++` question separator)
- Assignments with file upload, grading, and comments from the teacher
- Downloadable materials
- Forum (create threads, reply)
- Profile with light/dark theme

**Teacher / Admin**
- Dashboard: student count, live online count (via WebSocket presence), open assignments,
  visits chart
- Participants management (create/edit/delete, role-based restrictions — see below)
- Home page content management: banners, posts (title + optional description, image, or
  YouTube embed — blog-style), polls
- Lessons/topics management with drag-style reordering and the DOCX/PDF test importer
- Assignment creation and grading (grades feed into a student point/rating system)
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
| Database | SQLite (development) → PostgreSQL (production, no schema changes needed) |
| Auth | JWT in an httpOnly cookie |
| Realtime | WebSocket (`ws`) for online/offline presence |
| File uploads | Multer, served through a permission-checked download route |
| Email | Resend (registration / password-reset verification codes) |
| DOCX/PDF parsing | `mammoth`, `pdf-parse` |

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
cp .env.example .env   # fill in JWT_SECRET at minimum
npx prisma migrate dev
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
| `DATABASE_URL` | Prisma connection string (`file:./dev.db` for SQLite, or a `postgres://...` URL) |
| `JWT_SECRET` | Secret used to sign auth cookies |
| `PORT` | API port (default `4000`) |
| `CLIENT_ORIGIN` | Comma-separated list of allowed frontend origins for CORS, no trailing slash (e.g. `http://localhost:3000,https://your-app.vercel.app`) |
| `NODE_ENV` | `development` or `production` — also controls cross-site cookie settings |
| `RESEND_API_KEY` | Resend API key for sending verification emails |
| `EMAIL_FROM` | Sender address (must be on a domain verified in Resend) |
| `EMAIL_SENDING_ENABLED` | `"true"` to actually send emails; otherwise codes are returned in the API response for on-screen display (useful before a domain is verified) |

**`.env.local`** (frontend root)

| Variable | Description |
|---|---|
| `BACKEND_URL` | Backend origin, **no `/api` suffix, no trailing slash** (e.g. `http://localhost:4000` or `https://your-api.onrender.com`). Server-side only — used by the `/api/*` rewrite proxy in `next.config.js`, never sent to the browser. |
| `NEXT_PUBLIC_WS_URL` | Full WebSocket URL for the online-presence connection (e.g. `ws://localhost:4000/ws` or `wss://your-api.onrender.com/ws`) |

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
  `npm install && npx prisma migrate deploy`, start command `npm start`. Set the server env
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

> **SQLite vs PostgreSQL:** the schema was written without native enums specifically so
> switching `provider` in `server/prisma/schema.prisma` between `sqlite` and `postgresql`
> needs no other model changes — only the migration history has to match whichever provider
> is current (see above).

## Known limitations

- Email sending is feature-flagged off by default (`EMAIL_SENDING_ENABLED=false`) until a
  custom domain is verified with Resend — until then, verification codes are shown
  on-screen instead of emailed.
- No automated test suite yet.
