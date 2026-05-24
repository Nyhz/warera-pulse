import { describe, it, expect } from "vitest";
import { sma, ema } from "./indicators";

describe("sma", () => {
  it("uses an expanding window during warmup, then the full period", () => {
    // i0: 2/1, i1: 6/2, i2: 12/3, i3: (4+6+8)/3, i4: (6+8+10)/3
    expect(sma([2, 4, 6, 8, 10], 3)).toEqual([2, 3, 4, 6, 8]);
  });

  it("returns a value at every index (no nulls)", () => {
    const out = sma([1, 2, 3, 4], 2);
    expect(out).toHaveLength(4);
    expect(out.every((v) => v != null)).toBe(true);
  });

  it("returns the constant for a flat series", () => {
    expect(sma([5, 5, 5, 5], 2)).toEqual([5, 5, 5, 5]);
  });

  it("handles an empty series", () => {
    expect(sma([], 3)).toEqual([]);
  });
});

describe("ema", () => {
  it("seeds the first value with the first sample", () => {
    expect(ema([1, 2, 3], 2)[0]).toBe(1);
  });

  it("converges toward rising prices", () => {
    const out = ema([1, 2, 3], 2);
    expect(out).toHaveLength(3);
    expect(out[1]).toBeGreaterThan(out[0]!);
    expect(out[2]).toBeGreaterThan(out[1]!);
  });

  it("returns the constant for a flat series", () => {
    expect(ema([7, 7, 7], 3)).toEqual([7, 7, 7]);
  });

  it("handles an empty series", () => {
    expect(ema([], 9)).toEqual([]);
  });
});
