# MeetBox

> **Transcripción y resúmenes de reuniones en tiempo real. Presencial o virtual, sin perder un acuerdo.**

## Overview

MeetBox is a full-stack meeting management platform built for teams that want to organise, record and summarise their meetings without friction. It combines a rich web dashboard with an AI assistant (Meety), a native desktop companion app for audio capture, and deep integrations with the tools your team already uses.

**Key value proposition:** One platform for scheduling, note-taking, room management, and AI-powered meeting intelligence — accessible from a browser or a native desktop app.

```
┌─────────────────────────────────────────┐
│          MeetBox — Web Dashboard         │
│  Calendar · Notes · Rooms · AI · Meetings│
└───────────────────┬─────────────────────┘
                    │  MBOX token
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
| **Rooms** | Team spaces with member management; rooms can host meetings and appear in the calendar |
| **Meetings** | Today's meeting timeline, recording import, full history, per-meeting detail view |
| **Meety AI** | Conversational AI assistant powered by GPT-4o-mini with full tool-calling access to your calendar, rooms, notes and recordings; falls back to keyword responses if no API key is configured |
| **Integrations** | Connect Slack, Microsoft Teams, Google Calendar, Jira, Notion, Zoom; custom integrations; MeetBox Desktop connection via MBOX token |
| **Settings** | Profile, organisation info, notification preferences, security (password change), account management |
| **MeetBox Desktop** | Electron companion app — captures audio from video calls without bots; connects to the web app via a one-time MBOX token from the Integrations page |
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
| Auth | [NextAuth v5](https://authjs.dev/) — Google OAuth 2.0 + Email/Password + OTP magic codes |
| AI | [OpenAI API](https://platform.openai.com/) — `gpt-4o-mini`, function/tool calling |
| Email | Nodemailer (SMTP) or [Resend](https://resend.com/) |
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
ProjectIntegrator/
├── auth.ts                          # NextAuth config (Google OAuth + Credentials)
├── middleware.ts                    # Route protection
├── next.config.ts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx               # Root layout — ThemeProvider, SessionProvider, anti-FOUC
│   │   ├── page.tsx                 # Public landing page redirect
│   │   ├── auth/                    # /auth — sign-in page (Google + email/OTP)
│   │   ├── calendar/                # /calendar — public calendar view
│   │   ├── dashboard/               # /dashboard — main authenticated app shell
│   │   ├── privacy/ & terms/        # Static legal pages
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/   # NextAuth handler
│   │       │   ├── desktop/token/   # MBOX token generation & refresh
│   │       │   ├── otp/             # OTP send & verify endpoints
│   │       │   └── register/        # Email registration
│   │       ├── meetings/today/      # Today's meetings endpoint
│   │       ├── meetcalendar/        # Calendar CRUD (events, recurrence, iCal)
│   │       ├── meety/               # AI assistant API
│   │       │   └── conversations/[id]/messages/  # Message send/receive + tool loop
│   │       ├── rooms/               # Rooms + members CRUD
│   │       └── user/profile/        # Profile & integration settings
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── dashboard-shell.tsx  # Main layout: sidebar, header, nav routing
│   │   │   ├── meetcalendar-view.tsx
│   │   │   ├── meetbook-view.tsx
│   │   │   ├── meetings-view.tsx
│   │   │   ├── meety-view.tsx
│   │   │   ├── rooms-view.tsx
│   │   │   └── onboarding-tour.tsx
│   │   ├── landing/                 # Public landing page components
│   │   └── ui/                      # Shared UI primitives (session-provider, etc.)
│   │
│   └── lib/
│       ├── meety-tools.ts           # OpenAI tool schemas + executor (11 tools)
│       ├── supabase.ts              # Supabase client factory
│       ├── email.ts                 # Nodemailer / Resend email helpers
│       ├── otp-store.ts             # In-memory OTP store
│       ├── theme.tsx                # Dark/light theme context
│       └── utils.ts                 # cn() helper
│
├── supabase/
│   ├── schema.sql                   # Base tables: users
│   ├── meetcalendar_migration.sql   # calendar_events table
│   ├── meetings_migration.sql       # meeting_recordings table
│   ├── meety_chat_migration.sql     # chat_conversations + chat_messages tables
│   ├── recurrence_migration.sql     # Recurring event support
│   ├── rooms_migration.sql          # rooms + room_members tables
│   └── desktop_migration.sql        # desktop_tokens table
│
├── desktop/                         # Electron companion app (separate package)
│   ├── package.json
│   ├── build/                       # Electron Builder assets (icons, entitlements)
│   └── src/
│       ├── main/                    # Electron main process
│       ├── preload/                 # Preload scripts
│       └── renderer/                # React UI (Vite)
│
└── public/                          # Static assets (SVG illustrations, favicon)
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and **npm**
- A [Supabase](https://supabase.com/) project (free tier works)
- An [OpenAI API key](https://platform.openai.com/api-keys) _(optional — Meety works in fallback mode without one)_
- Google OAuth credentials _(optional — only needed for Google sign-in)_

### Environment Variables

Create a `.env.local` file at the project root with the following variables:

```bash
# ── Authentication ──────────────────────────────────────────
# Generate with: openssl rand -base64 32
AUTH_SECRET=your_nextauth_secret

# Full URL of your deployment (e.g. http://localhost:3000 in dev)
AUTH_URL=http://localhost:3000

# Google OAuth — from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ── AI ──────────────────────────────────────────────────────
# Optional. Without this key, Meety uses keyword-based fallback responses.
OPENAI_API_KEY=sk-...

# ── Supabase ────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ── Email (choose ONE: SMTP or Resend) ──────────────────────

# Option A — SMTP (e.g. Gmail, SendGrid, Mailgun)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=MeetBox <noreply@yourdomain.com>

# Option B — Resend (https://resend.com)
RESEND_API_KEY=re_...
```

> **Note:** Never commit `.env.local` to version control. It is already excluded in `.gitignore`.

### Database Setup

Run the SQL files in order in your Supabase project's **SQL Editor** (`Dashboard → SQL Editor → New query`):

```
1. supabase/schema.sql                  — users table
2. supabase/meetcalendar_migration.sql  — calendar_events table
3. supabase/meetings_migration.sql      — meeting_recordings table
4. supabase/meety_chat_migration.sql    — chat_conversations + chat_messages
5. supabase/recurrence_migration.sql    — recurring event columns
6. supabase/rooms_migration.sql         — rooms + room_members
7. supabase/desktop_migration.sql       — desktop_tokens
```

Each file is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) so re-running them is safe.

### Installation & Development

```bash
# 1. Clone the repository
git clone https://github.com/TITOS-DEV/ProjectIntegrator.git
cd ProjectIntegrator

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local and fill in your values

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm run start
```

---

## Desktop App

The `desktop/` folder contains a standalone **Electron + Vite + React** application that captures audio from video calls (Zoom, Google Meet, Microsoft Teams) directly on the user's machine — no bots, no third-party servers.

### Connection Flow

1. Open MeetBox in the browser and go to **Integrations**.
2. Copy the generated **MBOX token** (a unique code tied to your account).
3. Open MeetBox Desktop, click **Connect account**, and paste the token.
4. The desktop app is now linked to your account and can sync recordings.

Tokens can be regenerated at any time from the Integrations page, which immediately invalidates the previous token.

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

MeetBox supports two sign-in methods, both backed by NextAuth v5 with a **JWT session strategy**:

| Method | How it works |
|---|---|
| **Google OAuth** | One-click sign-in via Google. User is upserted into Supabase `users` table on first login. |
| **Email + OTP** | User registers with email + password, then verifies with a 6-digit OTP code sent to their inbox. Subsequent logins use email + password. |

The Supabase `users` table stores a `provider` column (`'google'` or `'email'`) so both paths coexist cleanly. Google users have a `NULL` `password_hash`.

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

### Available Tools

| Tool | Description |
|---|---|
| `get_today_meetings` | List all of the user's events for today |
| `get_events_in_range` | Fetch events between two dates (e.g. "this week") |
| `create_event` | Create a new calendar event, meeting, or reminder |
| `update_event` | Edit title, time, location, or description of an existing event |
| `delete_event` | Delete an event (asks for confirmation first) |
| `list_rooms` | List all rooms with member count and today's meeting count |
| `get_room_detail` | Get full detail of a room: members and today's meetings |
| `list_notebooks` | List all notebooks in MeetBook with their note count |
| `list_notes` | List notes inside a specific notebook |
| `create_note` | Create a new note in a notebook |
| `list_recent_recordings` | List the user's most recent meeting recordings |

Every tool call is scoped to the **authenticated user's `user_id`** — the model can never read or modify another user's data.

### Modes

| Mode | Behaviour |
|---|---|
| **Normal** | Standard responses, temperature 0.7 |
| **Think** | Step-by-step reasoning before answering, temperature 0.3 |
| **Deep Search** | Broader context synthesis across the conversation history |

---

## API Routes

```
POST   /api/auth/register              Register with email + password
POST   /api/auth/otp/send              Send OTP to email
POST   /api/auth/otp/verify            Verify OTP code
GET    /api/auth/desktop/token         Get MBOX desktop connection token
DELETE /api/auth/desktop/token         Regenerate MBOX token

GET    /api/meetings/today             Today's meetings for the home dashboard

GET    /api/meetcalendar/events        List calendar events
POST   /api/meetcalendar/events        Create event
PATCH  /api/meetcalendar/events/[id]   Update event
DELETE /api/meetcalendar/events/[id]   Delete event

GET    /api/rooms                      List rooms
POST   /api/rooms                      Create room
PATCH  /api/rooms/[id]                 Update room

GET    /api/meety/conversations        List conversations
POST   /api/meety/conversations        Create conversation
GET    /api/meety/conversations/[id]/messages    List messages
POST   /api/meety/conversations/[id]/messages    Send message → get AI reply

PATCH  /api/user/profile               Update profile & integrations
```

---

## Database Schema

The Supabase PostgreSQL schema includes the following tables:

| Table | Purpose |
|---|---|
| `users` | Accounts (email/Google), hashed passwords, avatar URLs |
| `calendar_events` | Events, meetings and reminders with recurrence support |
| `rooms` | Team spaces |
| `room_members` | People assigned to a room |
| `notebooks` | MeetBook notebooks |
| `notes` | Individual notes within notebooks (block content) |
| `meeting_recordings` | Imported audio/video recordings |
| `chat_conversations` | Meety AI conversation threads |
| `chat_messages` | Individual messages (user + assistant) with mode tag |
| `desktop_tokens` | MBOX tokens linking desktop app to web accounts |

Row Level Security (RLS) is enabled on all tables with service-role-only policies; all queries from Next.js use the Supabase service role key.

---

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable production-ready code |
| `feature/desktop` | MeetBox Desktop Electron app development |

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Follow the existing code style (TypeScript strict mode, Tailwind utility classes, no default exports for utility functions).
3. Keep API routes thin — business logic belongs in `src/lib/`.
4. All Supabase queries must be scoped to the authenticated user's ID.
5. If you add a new Meety tool, add its schema to `MEETY_TOOLS` in `src/lib/meety-tools.ts` and implement its case in `executeTool`.
6. Open a pull request against `main` with a clear description of what changed and why.

---

## License

[MIT](LICENSE)

---

<p align="center">
  Made with care · <strong>MeetBox</strong> · <a href="https://meetbox.io">meetbox.io</a>
</p>
