/** Moving-average periods + line colors, shared by the chart and its canvas. */
export const SMA_PERIOD = 20;
export const EMA_PERIOD = 9;
export const SMA_COLOR = "#d29922";
export const EMA_COLOR = "#39c0d3";

/** Moving averages over a close series. To draw a full line from the first bar
 * (even with few candles), the warmup uses an expanding window: early values
 * average whatever points exist so far, then converge to the true MA once
 * `period` points are available. No nulls — a value at every index. */

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    const count = Math.min(i + 1, period);
    out.push(sum / count);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev = 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}
