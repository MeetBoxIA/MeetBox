import { describe, expect, it } from "vitest";
import { checkOTP, saveOTP } from "@/lib/otp-store";

describe("OTP store", () => {
  it("tracks remaining attempts and locks after five invalid codes", () => {
    const email = `otp-${Date.now()}@example.com`;
    saveOTP(email, "1234");

    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = checkOTP(email, "0000");
      expect(result.valid).toBe(false);
      expect(result.attemptsRemaining).toBe(5 - attempt);
    }

    const locked = checkOTP(email, "0000");
    expect(locked.valid).toBe(false);
    expect(locked.attemptsRemaining).toBe(0);
    if (!locked.valid) expect(locked.reason).toBe("locked");
  });

  it("resets attempts when a new OTP is saved", () => {
    const email = `otp-reset-${Date.now()}@example.com`;
    saveOTP(email, "1234");
    checkOTP(email, "0000");

    saveOTP(email, "5678");
    const result = checkOTP(email, "5678");

    expect(result.valid).toBe(true);
    expect(result.attemptsRemaining).toBe(5);
  });
});
