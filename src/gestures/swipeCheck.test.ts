import { describe, expect, it } from "vitest";
import { checkProgress, shouldCompleteCheck } from "./swipeCheck.ts";

describe("checkProgress", () => {
  it("returns 0 for non-rightward movement", () => {
    expect(checkProgress(-20, 200, 0.55)).toBe(0);
    expect(checkProgress(0, 200, 0.55)).toBe(0);
  });

  it("scales progress toward 1 by threshold distance", () => {
    expect(checkProgress(55, 200, 0.55)).toBeCloseTo(0.5);
    expect(checkProgress(110, 200, 0.55)).toBeCloseTo(1);
    expect(checkProgress(200, 200, 0.55)).toBeCloseTo(1);
  });
});

describe("shouldCompleteCheck", () => {
  it("completes only at full progress", () => {
    expect(shouldCompleteCheck(0.99)).toBe(false);
    expect(shouldCompleteCheck(1)).toBe(true);
  });
});
