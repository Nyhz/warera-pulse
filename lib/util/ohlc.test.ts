import { describe, it, expect } from "vitest";
import { bucketCandles } from "./ohlc";

describe("bucketCandles", () => {
  const pts = [
    { t: 0, v: 10 },
    { t: 1800, v: 12 },
    { t: 3600, v: 9 },
    { t: 5400, v: 11 },
  ];

  it("groups samples into OHLC candles by bucket (open=first, close=last)", () => {
    expect(bucketCandles(pts, 3600, (p) => p.t, (p) => p.v)).toEqual([
      { time: 0, open: 10, high: 12, low: 10, close: 12 },
      { time: 3600, open: 9, high: 11, low: 9, close: 11 },
    ]);
  });

  it("sorts output by time even when input is unordered", () => {
    const unordered = [pts[2], pts[0], pts[3], pts[1]];
    const out = bucketCandles(unordered, 3600, (p) => p.t, (p) => p.v);
    expect(out.map((c) => c.time)).toEqual([0, 3600]);
  });

  it("works with ISO-timestamp rows via the time accessor", () => {
    const rows = [
      { ts: "1970-01-01T00:00:00.000Z", price: 5 },
      { ts: "1970-01-01T00:30:00.000Z", price: 8 },
    ];
    const out = bucketCandles(
      rows,
      3600,
      (r) => Math.floor(new Date(r.ts).getTime() / 1000),
      (r) => r.price,
    );
    expect(out).toEqual([{ time: 0, open: 5, high: 8, low: 5, close: 8 }]);
  });

  it("returns an empty array for no rows", () => {
    expect(bucketCandles([], 3600, (p: { t: number }) => p.t, () => 0)).toEqual([]);
  });
});
