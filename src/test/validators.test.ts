// Unit tests for Zod validation schemas in src/lib/validators.ts
import { describe, it, expect } from "vitest";
import {
  RegisterSchema,
  OtpVerifySchema,
  OtpSendSchema,
  DesktopConnectSchema,
  CreateEventSchema,
  CreateNoteSchema,
  SendMessageSchema,
  UpdateProfileSchema,
} from "@/lib/validators";

// ── RegisterSchema ─────────────────────────────────────────────────────────────
describe("RegisterSchema", () => {
  const valid = { name: "John Doe", email: "john@example.com", password: "Password1" };

  it("accepts valid input", () => {
    expect(RegisterSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects short name", () => {
    const r = RegisterSchema.safeParse({ ...valid, name: "J" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/2 characters/);
  });

  it("rejects invalid email", () => {
    const r = RegisterSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(r.success).toBe(false);
  });

  it("rejects short password", () => {
    const r = RegisterSchema.safeParse({ ...valid, password: "pass" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toMatch(/8 characters/);
  });

  it("rejects password without uppercase", () => {
    const r = RegisterSchema.safeParse({ ...valid, password: "password1" });
    expect(r.success).toBe(false);
  });

  it("rejects password without number", () => {
    const r = RegisterSchema.safeParse({ ...valid, password: "Password" });
    expect(r.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(RegisterSchema.safeParse({}).success).toBe(false);
  });
});

// ── OtpVerifySchema ────────────────────────────────────────────────────────────
describe("OtpVerifySchema", () => {
  it("accepts valid 4-digit OTP code", () => {
    expect(OtpVerifySchema.safeParse({ email: "a@b.com", code: "1234" }).success).toBe(true);
  });

  it("rejects 6-digit OTP code", () => {
    expect(OtpVerifySchema.safeParse({ email: "a@b.com", code: "123456" }).success).toBe(false);
  });

  it("rejects non-numeric OTP", () => {
    expect(OtpVerifySchema.safeParse({ email: "a@b.com", code: "abcd" }).success).toBe(false);
  });

  it("rejects missing email", () => {
    expect(OtpVerifySchema.safeParse({ code: "1234" }).success).toBe(false);
  });
});

// ── OtpSendSchema ──────────────────────────────────────────────────────────────
describe("OtpSendSchema", () => {
  it("accepts valid email", () => {
    expect(OtpSendSchema.safeParse({ email: "user@domain.co" }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(OtpSendSchema.safeParse({ email: "bad" }).success).toBe(false);
  });
});

// ── DesktopConnectSchema ───────────────────────────────────────────────────────
describe("DesktopConnectSchema", () => {
  const valid32 = "MBOX-" + "A".repeat(32);

  it("accepts a 32-hex token", () => {
    expect(DesktopConnectSchema.safeParse({ token: valid32 }).success).toBe(true);
  });

  it("rejects an 8-hex token (old format)", () => {
    expect(DesktopConnectSchema.safeParse({ token: "MBOX-A1B2C3D4" }).success).toBe(false);
  });

  it("rejects lowercase hex", () => {
    expect(DesktopConnectSchema.safeParse({ token: "MBOX-" + "a".repeat(32) }).success).toBe(false);
  });

  it("rejects missing prefix", () => {
    expect(DesktopConnectSchema.safeParse({ token: "A".repeat(32) }).success).toBe(false);
  });
});

// ── CreateEventSchema ──────────────────────────────────────────────────────────
describe("CreateEventSchema", () => {
  const valid = {
    title:    "Team standup",
    start_at: "2026-06-04T10:00:00+00:00",
  };

  it("accepts minimal valid event", () => {
    expect(CreateEventSchema.safeParse(valid).success).toBe(true);
  });

  it("defaults type to meeting", () => {
    const r = CreateEventSchema.safeParse(valid);
    expect(r.success && r.data.type).toBe("meeting");
  });

  it("rejects empty title", () => {
    expect(CreateEventSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("rejects invalid start_at format", () => {
    expect(CreateEventSchema.safeParse({ ...valid, start_at: "not-a-date" }).success).toBe(false);
  });

  it("rejects invalid event type", () => {
    expect(CreateEventSchema.safeParse({ ...valid, type: "unknown" }).success).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    expect(CreateEventSchema.safeParse({ ...valid, title: "x".repeat(201) }).success).toBe(false);
  });
});

// ── SendMessageSchema ──────────────────────────────────────────────────────────
describe("SendMessageSchema", () => {
  it("accepts valid message", () => {
    expect(SendMessageSchema.safeParse({ content: "Hello Meety" }).success).toBe(true);
  });

  it("rejects empty content", () => {
    expect(SendMessageSchema.safeParse({ content: "" }).success).toBe(false);
  });

  it("rejects content over 4000 chars", () => {
    expect(SendMessageSchema.safeParse({ content: "x".repeat(4001) }).success).toBe(false);
  });

  it("defaults mode to normal", () => {
    const r = SendMessageSchema.safeParse({ content: "hi" });
    expect(r.success && r.data.mode).toBe("normal");
  });

  it("accepts think and deep modes", () => {
    expect(SendMessageSchema.safeParse({ content: "hi", mode: "think" }).success).toBe(true);
    expect(SendMessageSchema.safeParse({ content: "hi", mode: "deep" }).success).toBe(true);
  });
});

// ── CreateNoteSchema ───────────────────────────────────────────────────────────
describe("CreateNoteSchema", () => {
  const valid = { notebook_id: "550e8400-e29b-41d4-a716-446655440000", title: "My note" };

  it("accepts valid note", () => {
    expect(CreateNoteSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid notebook_id (not UUID)", () => {
    expect(CreateNoteSchema.safeParse({ ...valid, notebook_id: "not-uuid" }).success).toBe(false);
  });

  it("rejects empty title", () => {
    expect(CreateNoteSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });
});

// ── UpdateProfileSchema ────────────────────────────────────────────────────────
describe("UpdateProfileSchema", () => {
  it("accepts partial update", () => {
    expect(UpdateProfileSchema.safeParse({ orgName: "Acme" }).success).toBe(true);
  });

  it("accepts empty object (no-op update)", () => {
    expect(UpdateProfileSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid teamSize", () => {
    expect(UpdateProfileSchema.safeParse({ teamSize: "100+" }).success).toBe(false);
  });

  it("rejects invalid meetingType", () => {
    expect(UpdateProfileSchema.safeParse({ meetingTypes: ["outdoor"] }).success).toBe(false);
  });

  it("rejects integrations list with too many items", () => {
    const list = Array.from({ length: 51 }, (_, i) => `tool-${i}`);
    expect(UpdateProfileSchema.safeParse({ integrations: list }).success).toBe(false);
  });
});
