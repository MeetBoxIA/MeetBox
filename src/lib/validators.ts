// Centralized Zod schemas for all API input validation.
// Import the relevant schema in each route handler instead of
// duplicating validation logic across endpoints.

import { z } from "zod";

// ── Auth ───────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name:     z.string().min(2, "Name must be at least 2 characters").max(80),
  email:    z.string().email("Invalid email address"),
  password: z.string()
    .min(8,  "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const OtpSendSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const OtpVerifySchema = z.object({
  email: z.string().email(),
  otp:   z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const DesktopConnectSchema = z.object({
  token: z.string().regex(/^MBOX-[0-9A-F]{32}$/, "Invalid desktop connection token"),
});

// ── Calendar events ────────────────────────────────────────────────────────────

export const CreateEventSchema = z.object({
  title:          z.string().min(1, "Title is required").max(200),
  type:           z.enum(["meeting", "event", "reminder"]).default("meeting"),
  start_at:       z.string().datetime({ offset: true, message: "start_at must be a valid ISO 8601 datetime" }),
  end_at:         z.string().datetime({ offset: true }).optional().nullable(),
  all_day:        z.boolean().default(false),
  location:       z.string().max(500).optional().nullable(),
  description:    z.string().max(5000).optional().nullable(),
  color:          z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  notify_email:   z.boolean().default(false),
  notify_minutes: z.number().int().min(0).max(10080).default(15),
  room_id:        z.string().uuid().optional().nullable(),
  // Recurrence
  recurrence_freq:  z.enum(["none", "daily", "weekly"]).default("none"),
  recurrence_days:  z.array(z.number().int().min(0).max(6)).optional(),
  recurrence_until: z.string().optional().nullable(),
});

export const UpdateEventSchema = CreateEventSchema.partial().extend({
  id: z.string().uuid("Invalid event ID"),
});

// ── Rooms ──────────────────────────────────────────────────────────────────────

export const CreateRoomSchema = z.object({
  name:        z.string().min(1, "Room name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  emoji:       z.string().max(4).default("🏠"),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#050040"),
});

export const RoomMemberSchema = z.object({
  name:  z.string().min(1).max(100),
  email: z.string().email("Invalid member email"),
  role:  z.string().max(50).optional(),
});

// ── MeetBook ───────────────────────────────────────────────────────────────────

export const CreateNotebookSchema = z.object({
  title: z.string().min(1, "Notebook title is required").max(100),
  emoji: z.string().max(4).default("📓"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const CreateNoteSchema = z.object({
  notebook_id: z.string().uuid("Invalid notebook ID"),
  title:       z.string().min(1, "Note title is required").max(200),
  emoji:       z.string().max(4).default("📄"),
  content:     z.string().max(100000).optional().default(""),
});

export const UpdateNoteSchema = z.object({
  title:     z.string().min(1).max(200).optional(),
  content:   z.string().max(100000).optional(),
  emoji:     z.string().max(4).optional(),
  is_pinned: z.boolean().optional(),
});

// ── Meety chat ─────────────────────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  content:    z.string().min(1, "Message cannot be empty").max(4000),
  mode:       z.enum(["normal", "think", "deep"]).default("normal"),
  timezone:   z.string().max(100).optional(),
  local_time: z.string().datetime({ offset: true }).optional(),
});

// ── User profile ───────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  orgName:      z.string().max(100).optional().nullable(),
  teamSize:     z.enum(["solo", "2-10", "11-50", "50+"]).optional().nullable(),
  meetingTypes: z.array(z.enum(["presencial", "virtual", "hibrida"])).optional(),
  integrations: z.array(z.string().max(100)).max(50).optional(),
});

// ── Helper: parse and return 400 on failure ────────────────────────────────────
import { NextResponse } from "next/server";

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { success: true;  data: T }
  | { success: false; response: ReturnType<typeof NextResponse.json> }
{
  const result = schema.safeParse(body);
  if (!result.success) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = result.error.issues.map((e: any) => ({
      field:   (e.path as (string | number)[]).join("."),
      message: e.message as string,
    }));
    return {
      success:  false,
      response: NextResponse.json({ error: "Validation failed", errors }, { status: 400 }),
    };
  }
  return { success: true, data: result.data };
}
