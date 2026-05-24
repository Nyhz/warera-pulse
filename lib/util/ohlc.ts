import type { Candle } from "@/lib/types";

/**
 * Bucket time-ordered price samples into OHLC candles of `bucketSeconds`.
 * Open = first sample seen in the bucket, close = last, high/low = extremes.
 * Inputs are expected oldest→newest so first-seen = open; output is sorted by
 * time. Generic over the row shape via time/price accessors so both the
 * session buffer ({t,v}) and the DB rows ({ts,price}) share one implementation.
 */
export function bucketCandles<T>(
  rows: T[],
  bucketSeconds: number,
  timeSec: (row: T) => number,
  price: (row: T) => number,
): Candle[] {
  const byBucket = new Map<number, Candle>();
  for (const row of rows) {
    const t = timeSec(row);
    const v = price(row);
    const time = t - (t % bucketSeconds);
    const cur = byBucket.get(time);
    if (!cur) {
      byBucket.set(time, { time, open: v, high: v, low: v, close: v });
    } else {
      cur.high = Math.max(cur.high, v);
      cur.low = Math.min(cur.low, v);
      cur.close = v;
    }
  }
  return [...byBucket.values()].sort((a, b) => a.time - b.time);
}
