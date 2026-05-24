import { describe, expect, it } from "vitest";
import { revealOffsetX, snapRevealOpen } from "./swipeReveal.ts";

const WIDTH = 40;

describe("revealOffsetX", () => {
  it("pulls closed card left up to reveal width", () => {
    expect(revealOffsetX(-40, WIDTH, false)).toBe(-40);
    expect(revealOffsetX(-100, WIDTH, false)).toBe(-40);
    expect(revealOffsetX(10, WIDTH, false)).toBe(0);
  });

  it("when revealed, only allows sliding back toward closed", () => {
    expect(revealOffsetX(0, WIDTH, true)).toBe(-40);
    expect(revealOffsetX(30, WIDTH, true)).toBe(-10);
    expect(revealOffsetX(80, WIDTH, true)).toBe(0);
    expect(revealOffsetX(-10, WIDTH, true)).toBe(-40);
  });
});

describe("snapRevealOpen", () => {
  it("opens when pulled past ratio of reveal width", () => {
    expect(snapRevealOpen(-40, WIDTH, 0.45)).toBe(true);
    expect(snapRevealOpen(-15, WIDTH, 0.45)).toBe(false);
    expect(snapRevealOpen(0, WIDTH, 0.45)).toBe(false);
  });
});
