# MeetBox

> **Transcripción y resúmenes de reuniones en tiempo real. Presencial o virtual, sin perder un acuerdo.**

## Overview

MeetBox is a full-stack meeting management platform built for teams that want to organise, record, summarise and act on their meetings without friction. It combines a rich web dashboard with an AI assistant (Meety), a native desktop companion app for audio capture, an AI-driven action pipeline (MeetAction) that turns recordings into approved tasks, and deep integrations with the tools your team already uses.

**Key value proposition:** One platform for scheduling, note-taking, room management, AI-powered meeting intelligence, and automatic execution of meeting outcomes (Jira issues, Notion pages, Slack messages, calendar events) — accessible from a browser or a native desktop app.

```
┌─────────────────────────────────────────┐
│          MeetBox — Web Dashboard         │
│ Calendar · Notes · Rooms · MeetAction ·  │
│        Meety AI · Integrations           │
└───────────────────┬─────────────────────┘
                    │  MBOX desktop session token
          ┌─────────▼──────────┐
          │ MeetBox Desktop App │
          │  (Electron + Vite)  │
          │  Audio capture for  │
          │  Zoom / Meet / Teams│
          └─────────────────────┘
```

> **Screenshot placeholder** — add a screenshot at `public/screenshot.png` and replace this line with `![MeetBox Dashboard](public/screenshot.png)`

---

## Features

| Module | What it does |
|---|---|
| **Home Dashboard** | Personalised greeting, next-meeting focus card, quick-access gateways to every module |
| **MeetCalendar** | Full calendar (month/week/day views), event CRUD, recurring events, Google Calendar sync, iCal sharing, email reminders |
| **MeetBook** | Block-based note editor, organised in notebooks, pinned notes, soft-delete with trash |
| **Rooms** | Team spaces (workspaces) with member management and role-based access; rooms can host meetings and appear in the calendar |
| **MeetAction** | Desktop recordings are transcribed, analysed by AI, and turned into reviewable action items (tasks, decisions, risks, next steps); approved items are executed automatically against Jira, Notion, Slack, MeetCalendar or MeetBook |
| **Meety AI** | Conversational AI assistant powered by GPT-4o-mini with tool-calling access to your calendar, rooms, notes, recordings and Jira; falls back to keyword responses if no API key is configured |
| **Integrations** | Connect Slack, Microsoft Teams, Google Calendar, Jira, Notion, Zoom; MeetBox Desktop connection via a one-time MBOX session token |
| **Settings** | Profile, organisation info, notification preferences, security (password change), account management |
| **MeetBox Desktop** | Electron companion app — captures audio from video calls without bots, imports pre-recorded files, and deep-links straight into the matching MeetAction session on the web dashboard |
| **Dark / Light mode** | System-aware theme with instant toggle, FOUC-free via inline script |
| **Onboarding tour** | Guided first-run walkthrough |

---

## Tech Stack

### Web App

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org/) — App Router, React Server Components |
| UI library | [React 19](https://react.dev/) |
| Language | TypeScript 5 |
| Styling | [Tailwind CSS v3](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) patterns (Radix UI primitives) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL + Row Level Security) |
| Auth | [NextAuth v5](https://authjs.dev/) — Google OAuth 2.0 + Email/Password with OTP verification |
| AI | [OpenAI API](https://platform.openai.com/) — `gpt-4o-mini`, function/tool calling |
| Email | [Brevo](https://www.brevo.com/) (HTTP API) → [Resend](https://resend.com/) → SMTP/Nodemailer, in that priority order |
| Testing | [Vitest](https://vitest.dev/) |
| Animations | [GSAP 3](https://gsap.com/) + [@gsap/react](https://gsap.com/react/) + [Framer Motion 12](https://www.framer.com/motion/) |
| Icons | [Lucide React](https://lucide.dev/) + [react-icons](https://react-icons.github.io/react-icons/) |

### Desktop App

| Layer | Technology |
|---|---|
| Shell | [Electron 33](https://www.electronjs.org/) |
| Bundler | [electron-vite 2](https://electron-vite.github.io/) |
| UI | React 19 + Tailwind CSS |
| Auto-update | electron-updater |
| Auto-launch | auto-launch |

---

## Project Structure

```
MeetBox/
├── auth.ts                          # NextAuth config (Google OAuth + Credentials, account linking)
├── middleware.ts                    # Route protection
├── next.config.ts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout — ThemeProvider, SessionProvider, anti-FOUC
│   │   ├── auth/                    # /auth — sign-in page (Google + email/OTP) and /auth/reset
│   │   ├── calendar/                # /calendar — public calendar view
│   │   ├── dashboard/               # /dashboard — main authenticated app shell
│   │   └── api/
│   │       ├── auth/                # NextAuth handler, register, OTP, password reset, OAuth
│   │       │   ├── notion/ jira/ google-calendar/   # Per-integration OAuth init + callback
│   │       │   └── password/        # forgot / reset (gated by password_hash, not provider)
│   │       ├── desktop/              # Desktop session auth, recording upload, job status
│   │       ├── meetaction/           # MeetAction sessions, items, approve, execute
│   │       ├── meetcalendar/         # Calendar CRUD (events, recurrence, iCal)
│   │       ├── meety/                # AI assistant API (conversations + tool loop)
│   │       ├── rooms/                # Rooms + members CRUD
│   │       └── integrations/         # Per-service connect/status endpoints
│   │
│   ├── components/
│   │   ├── dashboard/                # dashboard-shell + one view per module (meetaction-view, etc.)
│   │   ├── landing/                  # Public landing page components
│   │   └── ui/                       # Shared UI primitives (auth-tabs-card, otp-dialog, etc.)
│   │
│   └── lib/
│       ├── meety-tools.ts            # OpenAI tool schemas + executor
│       ├── integrations/             # Notion, Jira (jira-service.ts in services/), Slack, Zoom wrappers
│       ├── services/                 # Business logic (jira-service, pipeline-orchestrator, etc.)
│       ├── repositories/             # Supabase data-access layer
│       ├── supabase.ts               # Supabase client factory
│       ├── email.ts                  # Brevo / Resend / SMTP email helper chain
│       ├── otp-store.ts              # In-memory OTP store
│       ├── reset-token-store.ts      # In-memory password-reset token store
│       ├── rate-limit.ts             # In-memory sliding-window rate limiter
│       └── utils.ts                  # cn() helper
│
├── supabase/                          # SQL migrations (see Database Setup below)
│
├── desktop/                           # Electron companion app (separate package)
│   ├── package.json
│   ├── build/                         # Electron Builder assets (icons, entitlements)
│   └── src/
│       ├── main/                      # Electron main process (IPC, upload, deep-links)
│       ├── preload/                   # Preload scripts (sandboxed IPC bridge)
│       └── renderer/                  # React UI (Vite)
│
└── public/                            # Static assets (SVG illustrations, favicon)
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm** (the project is npm-only — don't mix in another package manager's lockfile)
- A [Supabase](https://supabase.com/) project (free tier works)
- An [OpenAI API key](https://platform.openai.com/api-keys) _(optional — Meety works in fallback mode without one)_
- Google OAuth credentials _(optional — only needed for Google sign-in)_
- A [Brevo](https://www.brevo.com/) account _(optional — without an email provider, OTP/reset codes print to the terminal in development)_

### Environment Variables

Create a `.env.local` file at the project root with the following variables:

```bash
# ── Authentication ──────────────────────────────────────────
# Generate with: openssl rand -base64 32
AUTH_SECRET=your_nextauth_secret
AUTH_URL=http://localhost:3000

# Google OAuth — from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ── AI ──────────────────────────────────────────────────────
# Optional. Without this key, Meety uses keyword-based fallback responses.
OPENAI_API_KEY=sk-...

# ── Supabase ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ── Email (priority: Brevo → Resend → SMTP) ─────────────────
# In development, with none configured the OTP/reset code is printed
# to the terminal instead of blocking registration.

# Option A — Brevo (recommended: sender verification in one click)
BREVO_API_KEY=xkeysib-...
SMTP_FROM=MeetBox <your_verified_sender@example.com>

# Option B — Resend (requires a verified sending domain)
RESEND_API_KEY=re_...
RESEND_FROM=MeetBox <noreply@yourdomain.com>

# Option C — Generic SMTP (e.g. Gmail with an app password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# ── Integrations (all optional) ─────────────────────────────
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_USER_EMAIL=...

JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...
JIRA_REDIRECT_URI=http://localhost:3000/api/auth/jira/callback

NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/notion/callback
```

> **Note:** Never commit `.env.local` to version control. It is already excluded in `.gitignore`.

### Database Setup

All SQL files live in `supabase/` and are idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), so re-running any of them is safe. Run them in your Supabase project's **SQL Editor** (`Dashboard → SQL Editor → New query`) in this order:

```
1. schema.sql                          — users table
2. user_profiles_migration.sql         — onboarding data + integrations badge list (required by /dashboard)
3. meetcalendar_migration.sql          — calendar_events
4. meetings_migration.sql              — meeting_recordings
5. meety_chat_migration.sql            — chat_conversations + chat_messages
6. recurrence_migration.sql            — recurring event columns
7. rooms_migration.sql                 — rooms + room_members
8. workspace_roles_migration.sql       — workspace/role scoping
9. workspace_scope_migration.sql       — workspace-scoped data access
10. desktop_pipeline_migration.sql     — desktop_sessions + recording → transcript → analysis pipeline
11. meetaction_migration.sql           — meet_action_sessions/items/executions/execution_log
12. rooms_meetaction_migration.sql     — links MeetAction sessions to rooms
13. recordatorios_migration.sql        — reminders
14. jira_migration.sql                 — Jira OAuth columns
15. notion_migration.sql               — Notion OAuth columns
16. notion_default_database_migration.sql — auto-provisioned Notion database id
17. password_reset_tokens_migration.sql — persists password-reset tokens (required by /api/auth/password/forgot and /reset)
18. otp_codes_migration.sql             — persists email-verification OTP codes (required by /api/auth/otp/send and /verify)
```

`_COMBINED_meetaction_setup.sql` bundles several of the MeetAction-related migrations for a faster one-shot setup; prefer the individual files above unless you know you want the combined version. `cleanup_old_calendar_events.sql` is a maintenance script, not part of the initial setup.

**Deprecated — do not run on new installs:** `zoom_migration.sql` (Zoom moved to Server-to-Server OAuth configured via env vars, not per-user columns) and `desktop_migration.sql` (superseded by `desktop_pipeline_migration.sql`'s `desktop_sessions` table). Both are kept only for installs that already ran them.

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/MeetBoxIA/MeetBox.git
cd MeetBox

# 2. Install dependencies
npm install

# 3. Configure environment
# Create .env.local and fill in the values from the section above

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing & Linting

```bash
npm test              # Run the test suite once (Vitest)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint (first run prompts you to choose a config — pick "Strict")
```

### Production Build

```bash
npm run build
npm run start
```

---

## Desktop App

The `desktop/` folder contains a standalone **Electron + Vite + React** application that captures audio from video calls (Zoom, Google Meet, Microsoft Teams) directly on the user's machine — no bots, no third-party servers. It can also import a pre-recorded audio/video file instead of recording live.

### Connection Flow

1. Open MeetBox in the browser and go to **Integrations**.
2. Generate an **MBOX session token** tied to your account.
3. Open MeetBox Desktop, click **Connect account**, and paste the token.
4. Record a meeting (or import an existing file) — it uploads, gets transcribed and analysed, and turns into a **MeetAction** session.
5. Click **"Revisar acciones en el dashboard"** to deep-link straight into that session on the web dashboard and approve/execute the resulting actions.

Tokens can be regenerated or revoked at any time from the Integrations page; revoking immediately invalidates the previous session.

### Desktop Development

```bash
cd desktop
npm install

# Development (hot-reload)
npm run dev

# Production build
npm run build

# Package for distribution
npm run package:linux   # Linux (.AppImage, .deb)
npm run package:win     # Windows (.exe)
npm run package:mac     # macOS (.dmg)
```

---

## Authentication

MeetBox supports two sign-in methods, both backed by NextAuth v5 with a **JWT session strategy**, and they can be **linked on the same email**:

| Method | How it works |
|---|---|
| **Google OAuth** | One-click sign-in via Google. On first sign-in the user is created in Supabase `users`; on subsequent sign-ins only the profile (name, avatar) is refreshed. |
| **Email + Password** | User registers with email + password, verifies with a 4-digit OTP code sent to their inbox, then logs in with email + password. Password can be recovered via **Forgot password** (emailed reset link, 30-minute single-use token). |

Whether an account can use manual login and password reset is determined by whether it has a `password_hash` set — **not** by which provider it originally signed up with. This means a user who registers with email + password and later also signs in with Google on the same address keeps full access to both: Google sign-in, manual email/password login, and password recovery all keep working together.

In development, OTP codes are always printed to the terminal (in addition to being emailed) so you can test the registration flow without checking an inbox.

---

## Meety AI Assistant

Meety is the built-in AI assistant, accessible from the sidebar in the dashboard.

### How it works

1. The client sends a message (and its local timezone + current time) to `POST /api/meety/conversations/[id]/messages`.
2. The server composes a system prompt that includes the **exact current date and time** in the user's timezone — preventing the model from placing events in the past.
3. The message history is passed to **OpenAI `gpt-4o-mini`** along with the tool definitions.
4. OpenAI decides whether to respond directly or call one or more tools (up to **6 tool-calling rounds** per request).
5. Tool results are fed back to the model, which synthesises a final plain-text / Markdown reply.
6. Both the user message and assistant reply are persisted in Supabase (`chat_messages`).

If `OPENAI_API_KEY` is not set (or the API call fails), Meety falls back to a lightweight keyword-based response system so the app remains functional during development.

Every tool call is scoped to the **authenticated user's `user_id`** — the model can never read or modify another user's data. See `src/lib/meety-tools.ts` for the full tool list (calendar, rooms, notes, recordings, Jira).

### Modes

| Mode | Behaviour |
|---|---|
| **Normal** | Standard responses, temperature 0.7 |
| **Think** | Step-by-step reasoning before answering, temperature 0.3 |
| **Deep Search** | Broader context synthesis across the conversation history |

---

## MeetAction & Integrations

MeetAction turns a meeting recording (live or imported) into a reviewable list of action items, which the user approves and MeetBox then executes against the connected destination:

| Destination | What gets created |
|---|---|
| **Jira** | An issue, with its type/priority/assignee/due date only sent if the project's create screen actually supports them (discovered via Jira's `createmeta` endpoint) — avoids failures on team-managed or localized projects |
| **Notion** | A page with native properties (Status, Priority, Type, Assignee, Email) mapped onto whatever columns the shared database already has, auto-adding any missing standard column; if no usable database is shared, one is auto-provisioned under an accessible page |
| **Slack** | A formatted message to a channel |
| **MeetCalendar** | A calendar event |
| **MeetBook** | A note in a "MeetAction" notebook |

All integrations (Slack, Microsoft Teams, Google Calendar, Jira, Notion, Zoom) use OAuth 2.0; tokens are stored on the user's row and refreshed automatically where the provider supports it (Jira).

---

## Database Schema

The Supabase PostgreSQL schema includes (non-exhaustive — see `supabase/*.sql` for the authoritative definitions):

| Table | Purpose |
|---|---|
| `users` | Accounts (email/Google), hashed passwords, avatar URLs, per-integration OAuth tokens |
| `calendar_events` | Events, meetings and reminders with recurrence support |
| `rooms` / `room_members` | Team workspaces and their members |
| `notebooks` / `notes` | MeetBook notebooks and block-content notes |
| `meeting_recordings` | Imported/recorded audio or video |
| `desktop_sessions` | Bearer-token sessions linking the desktop app to a web account |
| `meeting_processing_jobs` | Transcription/analysis pipeline job status |
| `meet_action_sessions` / `meet_action_items` | MeetAction sessions and their reviewable action items |
| `meet_action_executions` / `meet_action_execution_log` | Execution runs and per-item execution history |
| `chat_conversations` / `chat_messages` | Meety AI conversation threads and messages |

Row Level Security (RLS) is enabled on all tables with service-role-only policies; all queries from Next.js use the Supabase service role key, with results additionally scoped to the authenticated user's ID in application code (defense in depth).

---

## Branches

| Branch | Purpose |
|---|---|
| `feature/landing` | Main integration branch |
| `deploy` | Current deployment branch (may be ahead of `feature/landing`) |
| `feature/*` | Per-feature development branches (desktop, meetaction, meety, security, etc.) |

---

## Contributing

1. Create a feature branch from `feature/landing`.
2. Follow the existing code style (TypeScript strict mode, Tailwind utility classes, no default exports for utility functions).
3. Keep API routes thin — business logic belongs in `src/lib/`.
4. All Supabase queries must be scoped to the authenticated user's ID.
5. If you add a new Meety tool, add its schema to `MEETY_TOOLS` in `src/lib/meety-tools.ts` and implement its case in `executeTool`.
6. Open a pull request with a clear description of what changed and why.

For AI-assisted development with Claude Code, see `CLAUDE.md` for the full technical reference (directory map, debugging tips, common task recipes).

---

## License

[MIT](LICENSE)

---

<p align="center">
  Made with care · <strong>MeetBox</strong> · <a href="https://meetbox.io">meetbox.io</a>
</p>
