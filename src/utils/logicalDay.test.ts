import { describe, expect, it } from "vitest";
import { addDays, getLogicalDay } from "./logicalDay.ts";

describe("getLogicalDay", () => {
  it("uses the calendar date when at or after 4am", () => {
    const now = new Date("2026-05-23T10:00:00");
    expect(getLogicalDay(now)).toBe("2026-05-23");
  });

  it("uses the previous calendar date before 4am", () => {
    const now = new Date("2026-05-23T03:30:00");
    expect(getLogicalDay(now)).toBe("2026-05-22");
  });
});

describe("addDays", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });
});
