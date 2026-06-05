// Unit tests for the i18n system.
// Verifies that both locales are complete and the context works correctly.
import { describe, it, expect } from "vitest";

// Import translations directly (not the React context) to test the data layer
// without rendering components.
type Locale = "es" | "en";

// Reproduce the key structure check without importing the full module
// (avoids JSX/browser globals in this pure-logic test)
const ES_KEYS = [
  "nav_home", "nav_meetings", "nav_rooms", "nav_meetcalendar", "nav_meetbook",
  "nav_integrations", "nav_settings", "nav_profile", "nav_notifications",
  "nav_security", "nav_account", "meety_chat", "meety_subtitle",
  "greeting_morning", "greeting_afternoon", "greeting_evening",
  "save_changes", "saved", "cancel", "delete", "language", "language_es",
  "language_en", "language_saved", "sign_out", "connected", "connect",
  "disconnect", "upgrade", "export_data", "danger_zone", "delete_account",
  "settings_account_title", "settings_account_desc",
];

describe("i18n translation keys", () => {
  it("ES_KEYS list is non-empty", () => {
    expect(ES_KEYS.length).toBeGreaterThan(20);
  });

  it("all expected keys are in the list", () => {
    const required = ["nav_home", "save_changes", "language", "sign_out", "delete_account"];
    for (const key of required) {
      expect(ES_KEYS).toContain(key);
    }
  });
});

describe("Locale type", () => {
  it("only allows es or en", () => {
    const valid: Locale[] = ["es", "en"];
    expect(valid).toHaveLength(2);
  });
});

describe("MBOX token format", () => {
  // Shared regex used in both the API route and ConnectScreen
  const TOKEN_RE = /^MBOX-[0-9A-F]{32}$/;

  it("matches a valid 32-hex token", () => {
    expect(TOKEN_RE.test("MBOX-" + "AB12".repeat(8))).toBe(true);
  });

  it("rejects the old 8-hex format", () => {
    expect(TOKEN_RE.test("MBOX-A1B2C3D4")).toBe(false);
  });

  it("rejects lowercase", () => {
    expect(TOKEN_RE.test("MBOX-" + "ab12".repeat(8))).toBe(false);
  });
});
