// Unit tests for the Meety AI tool definitions.
// Ensures all tools have the correct structure for OpenAI function calling.
import { describe, it, expect } from "vitest";
import { MEETY_TOOLS } from "@/lib/meety-tools";

describe("MEETY_TOOLS structure", () => {
  it("exports an array", () => {
    expect(Array.isArray(MEETY_TOOLS)).toBe(true);
  });

  it("has at least 10 tools", () => {
    expect(MEETY_TOOLS.length).toBeGreaterThanOrEqual(10);
  });

  it("every tool has type = 'function'", () => {
    for (const tool of MEETY_TOOLS) {
      expect(tool.type).toBe("function");
    }
  });

  it("every tool has a non-empty name", () => {
    for (const tool of MEETY_TOOLS) {
      expect(typeof tool.function.name).toBe("string");
      expect(tool.function.name.length).toBeGreaterThan(0);
    }
  });

  it("every tool has a non-empty description", () => {
    for (const tool of MEETY_TOOLS) {
      expect(typeof tool.function.description).toBe("string");
      expect(tool.function.description.length).toBeGreaterThan(0);
    }
  });

  it("every tool has a parameters object", () => {
    for (const tool of MEETY_TOOLS) {
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe("object");
    }
  });

  it("tool names are unique", () => {
    const names = MEETY_TOOLS.map((t) => t.function.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  const EXPECTED_TOOLS = [
    "get_today_meetings",
    "get_events_in_range",
    "create_event",
    "update_event",
    "delete_event",
    "list_rooms",
    "get_room_detail",
    "list_notebooks",
    "list_notes",
    "create_note",
    "list_recent_recordings",
  ];

  it.each(EXPECTED_TOOLS)("includes the tool '%s'", (name) => {
    const found = MEETY_TOOLS.find((t) => t.function.name === name);
    expect(found).toBeDefined();
  });
});

describe("create_event tool schema", () => {
  const tool = MEETY_TOOLS.find((t) => t.function.name === "create_event")!;

  it("requires title and start_at", () => {
    expect(tool.function.parameters.required).toContain("title");
    expect(tool.function.parameters.required).toContain("start_at");
  });
});

describe("create_note tool schema", () => {
  const tool = MEETY_TOOLS.find((t) => t.function.name === "create_note")!;

  it("requires notebook_id and title", () => {
    expect(tool.function.parameters.required).toContain("notebook_id");
    expect(tool.function.parameters.required).toContain("title");
  });
});
