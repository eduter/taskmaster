import { describe, expect, it } from "vitest";
import { isDominantHorizontal, resolveAxis } from "./axisLock.ts";

describe("resolveAxis", () => {
  it("returns null when movement is below threshold", () => {
    expect(resolveAxis(5, 3, 10)).toBeNull();
    expect(resolveAxis(-9, 9, 10)).toBeNull();
  });

  it("locks horizontal when |dx| dominates", () => {
    expect(resolveAxis(-20, 4, 10)).toBe("horizontal");
    expect(resolveAxis(30, 8, 10)).toBe("horizontal");
  });

  it("locks vertical when |dy| dominates", () => {
    expect(resolveAxis(4, 25, 10)).toBe("vertical");
    expect(resolveAxis(-6, -18, 10)).toBe("vertical");
  });
});

describe("isDominantHorizontal", () => {
  it("rejects diagonal wobble during long-press", () => {
    expect(isDominantHorizontal(12, 10, 10, 1.5)).toBe(false);
  });

  it("accepts clear horizontal swipes", () => {
    expect(isDominantHorizontal(-30, 4, 10, 1.5)).toBe(true);
    expect(isDominantHorizontal(40, 5, 10, 1.5)).toBe(true);
  });
});
