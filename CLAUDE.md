# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Quick Start Commands

### Development
```bash
npm install              # Install root dependencies (web app)
npm run dev              # Start Next.js dev server on http://localhost:3000
npm run build            # Production build
npm run start            # Run production build
npm run lint             # Run ESLint
```

### Testing
```bash
npm test                 # Run all tests once (Vitest)
npm run test:watch       # Watch mode for development
npm run test:coverage    # Generate coverage report
```

### Desktop App (separate package)
```bash
cd desktop
npm install              # Install desktop dependencies
npm run dev              # Development (hot-reload with --no-sandbox)
npm run build            # Build for production
npm run package:win      # Package for Windows (.exe)
npm run package:mac      # Package for macOS (.dmg)
npm run package:linux    # Package for Linux (.AppImage, .deb)
```

---

## Project Overview

**MeetBox** is a full-stack SaaS meeting management platform with:
- **Web app** (Next.js 15, React 19, TypeScript) — dashboard with 8 modules
- **Desktop app** (Electron 33 + React) — audio capture for video calls
- **Backend** — Next.js API routes with Supabase PostgreSQL + Row Level Security
- **AI** — Meety assistant (OpenAI `gpt-4o-mini`) with 11 tool-calling integrations

**Key value:** Teams can schedule, record, summarise, and manage meetings from one platform with deep integrations (Slack, Zoom, Google Calendar, Notion, Jira, Teams).

---

## Architecture

### Layer Structure

```
┌─ Browser (React components + TailwindCSS)
│
├─ Next.js App Router (React Server Components + Client Components)
│  ├─ /auth routes (Google OAuth, Email/OTP, password reset)
│  ├─ /dashboard/* (protected, authenticated routes)
│  ├─ /api/* (internal API for web + desktop app)
│  └─ /calendar (public iCal/calendar view)
│
├─ Business Logic (/lib/repositories, /lib/services)
│
├─ Supabase (PostgreSQL + RLS policies + service role queries)
│
└─ External APIs (OpenAI, Google Calendar, Zoom, Slack, Notion, Jira)
```

### Directory Map

| Path | Purpose |
|------|---------|
| `src/app/` | Next.js App Router — routes, layouts, pages |
| `src/app/api/` | Internal API endpoints (scoped to authenticated user via service role) |
| `src/components/dashboard/` | Main dashboard shell + 8 view modules (calendar, notes, rooms, meetings, AI, etc.) |
| `src/components/landing/` | Public landing page components |
| `src/components/ui/` | Shared UI primitives (SessionProvider, AuthTabsCard, etc.) |
| `src/lib/repositories/` | Data access layer — Supabase queries |
| `src/lib/services/` | Business logic — calendar sync, integrations, validation |
| `src/lib/integrations/` | Third-party API wrappers (Google, Zoom, Slack, Notion, Jira) |
| `src/lib/types/` | TypeScript type definitions |
| `src/lib/meety-tools.ts` | AI tool schemas + execution logic |
| `src/lib/meety-tools.ts` | Meety AI tool definitions (11 tools for calendar, rooms, notes, recordings) |
| `src/lib/email.ts` | Nodemailer/Resend email helpers (OTP, password reset) |
| `src/lib/i18n.tsx` | i18n context (ES/EN) with real-time switching |
| `auth.ts` | NextAuth configuration (Google OAuth + email/password credentials) |
| `middleware.ts` | Route protection — redirects unauthenticated users to `/auth` |
| `desktop/` | Electron app (separate Node package) |
| `supabase/` | Database migrations (11 SQL files in order) |

---

## Database Schema & Migrations

Run all SQL files in `/supabase/` in this order in your Supabase SQL Editor:

1. `schema.sql` — users table + auth setup
2. `meetcalendar_migration.sql` — calendar_events (with recurrence)
3. `meetings_migration.sql` — meeting_recordings
4. `meety_chat_migration.sql` — chat_conversations + chat_messages
5. `recurrence_migration.sql` — recurring event columns
6. `rooms_migration.sql` — rooms + room_members
7. `desktop_migration.sql` — desktop_tokens (MBOX token management)
8. Additional integrations migrations (notion_migration.sql, etc.)

All tables use **Row Level Security (RLS)** with service-role-only policies. All queries from Next.js use the Supabase service role key (`SUPABASE_SERVICE_ROLE_KEY`).

### Key Tables
- **users** — auth (email, password_hash, provider, OAuth IDs)
- **calendar_events** — events with recurrence (rrule, timezone)
- **rooms** — team spaces with members
- **chat_conversations + chat_messages** — Meety AI chat history
- **meeting_recordings** — imported audio/video
- **desktop_tokens** — MBOX tokens linking desktop app to web accounts
- **notebooks + notes** — MeetBook content
- **integrations tables** — Slack, Zoom, Google Calendar, Notion, Jira tokens/metadata

---

## Authentication

**NextAuth v5** with JWT sessions. Two strategies:

| Method | Flow |
|--------|------|
| **Google OAuth** | Click → Google redirect → upserted into `users` table as provider='google' |
| **Email/OTP** | Register with email + password → 6-digit OTP code sent → password hashed with bcryptjs |

Routes:
- `POST /api/auth/register` — email registration
- `POST /api/auth/otp/send` — send OTP to email
- `POST /api/auth/otp/verify` — verify code + create session
- `POST /api/auth/password/forgot` — initiate password reset
- `POST /api/auth/password/reset` — reset with token

Session is stored in JWT cookie. Middleware (`middleware.ts`) protects `/dashboard/*` routes.

---

## Meety AI Assistant

Meety is a conversational AI powered by **OpenAI `gpt-4o-mini`** with tool-calling support.

### How It Works
1. User sends a message to `POST /api/meety/conversations/[id]/messages`
2. Server composes system prompt with user's timezone + current time (prevents scheduling in past)
3. Model decides to respond directly or call tools (up to 6 rounds)
4. Tool results fed back to model → synthesises final reply
5. Both user message + assistant reply persisted in `chat_messages` table

### Available Tools (11 total)
- **Calendar:** `get_today_meetings`, `get_events_in_range`, `create_event`, `update_event`, `delete_event`
- **Rooms:** `list_rooms`, `get_room_detail`
- **Notes:** `list_notebooks`, `list_notes`, `create_note`
- **Recordings:** `list_recent_recordings`

All tools are **scoped to authenticated user's `user_id`** — model cannot read/modify other users' data.

**Modes:** Normal (temp 0.7), Think (step-by-step, temp 0.3), Deep Search (broader context)

If `OPENAI_API_KEY` is not set, Meety uses keyword-based fallback responses.

Tool schemas defined in `src/lib/meety-tools.ts` — both OpenAI schema + executor logic in same file.

---

## Key Code Patterns

### API Route Structure
```typescript
// src/app/api/[module]/[resource]/route.ts
import { auth } from '@/auth'
import { createSupabaseClient } from '@/lib/supabase'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  
  const supabase = createSupabaseClient()
  // Query scoped to authenticated user
  const { data, error } = await supabase
    .from('table')
    .select('*')
    .eq('user_id', session.user.id)
  
  return Response.json(data)
}
```

**Key pattern:** All Supabase queries are **scoped to the authenticated user's ID** — data isolation is enforced in code, not just RLS (defense in depth).

### Repositories & Services
- **Repositories** (`src/lib/repositories/`) — thin data access layer, scoped queries
- **Services** (`src/lib/services/`) — business logic, validation, external API calls
- API routes delegate to services, which use repositories

Example:
```typescript
// api/meetcalendar/events route
const events = await eventService.getEvents(userId, start, end)
return Response.json(events)
```

### Components
- **Dashboard views** (`src/components/dashboard/`) — 8 modules (calendar, notes, rooms, meetings, Meety AI, etc.)
- **UI primitives** (`src/components/ui/`) — SessionProvider, AuthTabsCard (shared patterns)
- **Landing page** (`src/components/landing/`) — public marketing components

### Styling
- **TailwindCSS v3** — utility-first classes
- **shadcn/ui patterns** — Radix UI primitives (Dialog, Tabs, Slot, etc.)
- **Dark/light mode** — theme context with `useTheme()` hook, FOUC-free via inline script in layout
- **Animations** — GSAP 3 + Framer Motion 12

### Validation
- **Zod** (`src/lib/validators.ts`) — schema validation for inputs
- **bcryptjs** — password hashing
- **input-otp** — OTP input component

---

## Desktop App (Electron)

Separate Node package at `desktop/`. Captures audio from video calls without bots.

### Connection Flow
1. User generates **MBOX token** from web app `/integrations`
2. Pastes token into Desktop app → connects via `POST /api/auth/desktop/connect`
3. Desktop stores encrypted token locally, re-authenticates with `POST /api/auth/desktop/validate`
4. Desktop can upload recordings to `POST /api/desktop/upload`

### Structure
- `desktop/src/main/` — Electron main process (IPC handlers)
- `desktop/src/preload/` — Preload scripts (sandboxed IPC bridge)
- `desktop/src/renderer/` — React UI (Vite-bundled)
- `electron.vite.config.ts` — electron-vite config for three entry points

Tokens expire after inactivity; users can regenerate from web app, invalidating previous token immediately.

---

## Environment Variables

Create `.env.local` at project root:

```bash
# NextAuth
AUTH_SECRET=openssl rand -base64 32  # Generate once
AUTH_URL=http://localhost:3000       # or production URL

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...        # Keep secret!

# OpenAI (optional; Meety uses fallback if absent)
OPENAI_API_KEY=sk-...

# Email (choose SMTP or Resend)
SMTP_HOST=smtp.gmail.com             # or your provider
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...                        # Use app password for Gmail
SMTP_FROM=MeetBox <noreply@example.com>

# OR Resend
RESEND_API_KEY=re_...

# For integrations (optional)
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
# etc.
```

`.env.local` is in `.gitignore` — never commit it.

---

## Testing

**Vitest** with jsdom. Configuration in `vitest.config.ts`.

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run test:coverage # HTML coverage report
```

Test setup in `src/test/setup.ts` (registered in vitest.config.ts).

Coverage targets:
- `src/lib/**` — all utility/service code
- `src/app/api/**` — API route logic

Write tests for:
- Validation functions (Zod schemas)
- Service layer business logic
- API route handlers (mock Supabase, auth)
- Tool execution (Meety tools)

Avoid testing:
- React component rendering (not the focus; use `/verify` to test UI manually)
- External API calls (mock them)

---

## Integrations

Integrations are **OAuth-flow connectors** to external services. Each has:
- **Auth route** (`/api/auth/<service>`) — redirects to OAuth provider
- **Callback** (`/api/auth/<service>/callback`) — exchanges code for token, stores in user's `integrations` metadata
- **Status endpoint** (`/api/auth/<service>/status`) — returns connection state
- **Service logic** (`src/lib/integrations/<service>.ts`) — API wrapper for calls

**Implemented:**
- Google Calendar (2-way sync)
- Slack (send notifications)
- Zoom (list recordings)
- Notion (sync notes)
- Jira (create/link issues)
- Microsoft Teams (presence, chat)

All tokens stored in user's `integrations` JSON field in Supabase `users` table.

---

## Git Workflow

| Branch | Purpose |
|--------|---------|
| `feature/landing` | Main development branch |
| `deploy` | Current working branch (may be ahead of main) |
| `feature/desktop` | Electron app development |

Prefer **squash-and-merge** to `main` for clean history.

---

## Performance & Observability

- **Logging:** `src/lib/logger.ts` — console logger with timestamps
- **Middleware:** `middleware.ts` — route protection, session validation
- **Error handling:** Centralized in API routes; return 401 for auth errors, 400 for validation, 500 for server errors
- **Rate limiting:** Not yet implemented (consider for production)
- **Caching:** Supabase edge caching for read-only routes; consider `revalidateTag` for ISR

---

## Common Tasks

### Add a new API route
1. Create `src/app/api/[module]/[resource]/route.ts`
2. Use pattern above (auth + Supabase scoped query)
3. Write tests in `src/app/api/[module]/[resource].test.ts`
4. Add to README.md API Routes section if user-facing

### Add a Meety tool
1. Add schema to `MEETY_TOOLS` array in `src/lib/meety-tools.ts`
2. Implement case in `executeTool()` function
3. Ensure tool is scoped to `user_id`
4. Test with `POST /api/meety/conversations/[id]/messages`

### Add a new integration
1. Create `src/lib/integrations/<service>.ts` with OAuth flow
2. Create `src/app/api/auth/<service>/route.ts` (initiate OAuth)
3. Create `src/app/api/auth/<service>/callback/route.ts` (handle callback)
4. Create `src/app/api/auth/<service>/status/route.ts` (check connection)
5. Store token in user's `integrations` metadata

### Update database schema
1. Create new SQL file in `supabase/` (idempotent: use `IF NOT EXISTS`)
2. Test locally in Supabase SQL Editor
3. Document order in `CLAUDE.md` above
4. Run in order: `schema.sql` → migrations → new file

### Dark/Light mode
- Theme state in `src/lib/theme.tsx` (React Context)
- Use `useTheme()` hook in components
- Tailwind classes: `dark:` prefix for dark mode
- Anti-FOUC inline script in `src/app/layout.tsx`

---

## Debugging Tips

- **Session missing?** Check `middleware.ts` — ensure route is protected
- **Supabase queries failing?** Verify `user_id` is being passed and RLS policies allow it
- **AI tool not working?** Check `OPENAI_API_KEY` is set; test tool schema in `meety-tools.ts`
- **Desktop token invalid?** Regenerate from web app `/integrations`; old token is invalidated
- **Email not sending?** Check `SMTP_*` or `RESEND_API_KEY` env vars; test with test email
- **Type errors?** Run `npm run lint` to catch TypeScript issues; update tsconfig if needed

---

## Key Dependencies & Versions

| Package | Version | Why |
|---------|---------|-----|
| **Next.js** | 15.1.3 | App Router, React Server Components, API routes |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5 | Type safety |
| **TailwindCSS** | 3.4.17 | Styling |
| **Supabase** | 2.106.2 | PostgreSQL + auth + RLS |
| **NextAuth** | 5.0.0-beta.31 | Session management (JWT) |
| **OpenAI** | (via API) | Meety AI tool-calling |
| **Framer Motion** | 12.40.0 | Animations |
| **GSAP** | 3.15.0 | Advanced animations |
| **Radix UI** | (primitives) | Accessible UI components |
| **Vitest** | 4.1.8 | Testing |
| **Electron** | 33 | Desktop app shell |

---

## Known Limitations & Future Work

- **Integrations:** UI complete, some API logic pending (Jira, Teams)
- **Rate limiting:** Not implemented; add for production
- **Email queuing:** Uses direct SMTP; consider job queue for reliability
- **Desktop auto-update:** Implemented via `electron-updater`; requires hosted release channel
- **Analytics:** Not yet integrated
- **i18n:** ES/EN only; other languages can be added to `src/lib/i18n.tsx`

---

## Support & Resources

- **README.md** — setup, features, tech stack
- **LEVANTAMIENTO_MEETBOX.md** — requirements doc, objectives, backlog (Spanish)
- **GitHub Issues** — bug tracking
- **Supabase Dashboard** — database, auth, RLS inspection

For Claude Code help: https://github.com/anthropics/claude-code/issues
