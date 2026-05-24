/** Always-rounded number formatting — no float artifacts leak to the UI. */

/** Coerce an unknown to a finite number, else 0. Used at the gateway boundary. */
export function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Thousands-grouped money with fixed decimals, e.g. 12345.6 → "12,345.60". */
export function money(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Trim a possibly-decimal number: 50 → "50", 50.5 → "50.5" (≤1 decimal). */
export function trimDecimal(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Decimals to show for a price: 4 for sub-1 values, 3 otherwise (min 3). */
export function priceDecimals(n: number): number {
  const a = Math.abs(n);
  return a > 0 && a < 1 ? 4 : 3;
}

export function formatPrice(n: number, decimals = priceDecimals(n)): string {
  return n.toFixed(decimals);
}

export function formatPct(fraction: number, decimals = 1): string {
  const sign = fraction > 0 ? "+" : "";
  return `${sign}${(fraction * 100).toFixed(decimals)}%`;
}

export function arrow(value: number): "▲" | "▼" {
  return value >= 0 ? "▲" : "▼";
}

/** Compact large numbers: 62_680_000 → "62.68M", 2_100 → "2.1k". */
export function formatCompact(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

/** Seconds → "m:ss" countdown, e.g. 83 → "1:23". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
