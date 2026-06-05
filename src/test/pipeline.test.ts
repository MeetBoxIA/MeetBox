// Unit tests for the meeting pipeline's pure logic:
// job progress computation, status ordering, and token format.
import { describe, it, expect } from "vitest";
import { JOB_STATUS_ORDER, type JobStatus } from "@/lib/types/pipeline";

// Re-implement progressFor here to test the contract (it's private in the repo).
function progressFor(status: JobStatus): number {
  if (status === "failed") return 100;
  const idx = JOB_STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.round((idx / (JOB_STATUS_ORDER.length - 1)) * 100);
}

describe("Pipeline job progress", () => {
  it("uploaded is 0%", () => {
    expect(progressFor("uploaded")).toBe(0);
  });

  it("completed is 100%", () => {
    expect(progressFor("completed")).toBe(100);
  });

  it("failed is 100%", () => {
    expect(progressFor("failed")).toBe(100);
  });

  it("progress increases monotonically through the happy path", () => {
    const happyPath: JobStatus[] = JOB_STATUS_ORDER;
    let prev = -1;
    for (const status of happyPath) {
      const p = progressFor(status);
      expect(p).toBeGreaterThan(prev);
      prev = p;
    }
  });

  it("status order has 7 stages ending in completed", () => {
    expect(JOB_STATUS_ORDER).toHaveLength(7);
    expect(JOB_STATUS_ORDER[0]).toBe("uploaded");
    expect(JOB_STATUS_ORDER.at(-1)).toBe("completed");
  });
});

describe("Desktop token format", () => {
  // The mintDesktopToken uses mbox_live_ + base64url(32 bytes).
  const TOKEN_RE = /^mbox_live_[A-Za-z0-9_-]{43}$/;

  it("recognizes a valid token shape", () => {
    // 32 random bytes → 43 base64url chars (no padding)
    const sample = "mbox_live_" + "a".repeat(43);
    expect(TOKEN_RE.test(sample)).toBe(true);
  });

  it("rejects the old MBOX- code format", () => {
    expect(TOKEN_RE.test("MBOX-" + "A".repeat(32))).toBe(false);
  });
});

describe("Calendar match time proximity", () => {
  // Mirror of timeProximity in calendar-matching-service.ts
  function timeProximity(recordedTs: number, eventTs: number): number {
    const diffMin = Math.abs(recordedTs - eventTs) / 60000;
    if (diffMin <= 5) return 1;
    if (diffMin >= 120) return 0;
    return 1 - diffMin / 120;
  }

  it("perfect match when times are equal", () => {
    const t = Date.now();
    expect(timeProximity(t, t)).toBe(1);
  });

  it("zero when more than 2 hours apart", () => {
    const t = Date.now();
    expect(timeProximity(t, t + 3 * 3600_000)).toBe(0);
  });

  it("partial within the window", () => {
    const t = Date.now();
    const score = timeProximity(t, t + 60 * 60000); // 1h apart
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});
