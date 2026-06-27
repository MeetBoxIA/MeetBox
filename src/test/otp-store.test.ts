// otp-store.ts now persists to Supabase (see supabase/otp_codes_migration.sql)
// instead of an in-process Map, so requests survive across serverless
// instances. This fake mimics a real `otp_codes` table backed by a Map,
// keeping the test meaningful without needing a real Supabase connection.
import { describe, expect, it, vi, beforeEach } from "vitest";

interface OtpRow {
  email: string;
  code: string;
  expires_at: string;
  attempts: number;
}

const tables = new Map<string, Map<string, OtpRow>>();

function table(name: string): Map<string, OtpRow> {
  if (!tables.has(name)) tables.set(name, new Map());
  return tables.get(name)!;
}

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    from: (name: string) => ({
      upsert: async (row: OtpRow) => {
        table(name).set(row.email, row);
        return { data: row, error: null };
      },
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => ({ data: table(name).get(val) ?? null, error: null }),
        }),
      }),
      update: (patch: Partial<OtpRow>) => ({
        eq: async (_col: string, val: string) => {
          const row = table(name).get(val);
          if (row) table(name).set(val, { ...row, ...patch });
          return { data: null, error: null };
        },
      }),
      delete: () => ({
        eq: async (_col: string, val: string) => {
          table(name).delete(val);
          return { data: null, error: null };
        },
      }),
    }),
  }),
}));

const { checkOTP, saveOTP } = await import("@/lib/otp-store");

describe("OTP store", () => {
  beforeEach(() => {
    tables.clear();
  });

  it("tracks remaining attempts and locks after five invalid codes", async () => {
    const email = `otp-${Date.now()}@example.com`;
    await saveOTP(email, "1234");

    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await checkOTP(email, "0000");
      expect(result.valid).toBe(false);
      expect(result.attemptsRemaining).toBe(5 - attempt);
    }

    const locked = await checkOTP(email, "0000");
    expect(locked.valid).toBe(false);
    expect(locked.attemptsRemaining).toBe(0);
    if (!locked.valid) expect(locked.reason).toBe("locked");
  });

  it("resets attempts when a new OTP is saved", async () => {
    const email = `otp-reset-${Date.now()}@example.com`;
    await saveOTP(email, "1234");
    await checkOTP(email, "0000");

    await saveOTP(email, "5678");
    const result = await checkOTP(email, "5678");

    expect(result.valid).toBe(true);
    expect(result.attemptsRemaining).toBe(5);
  });
});
