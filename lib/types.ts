export type Item = {
  symbol: string;
  /** Human-readable name shown under the symbol in the markets rail. */
  name: string;
  /** Current price in credits. */
  price: number;
  /** 24h change as a signed fraction, e.g. 0.052 = +5.2%. */
  change24h: number;
  /** 24h hourly closes for the rail sparkline (same series as the chart). */
  spark?: number[];
};

export type Candle = {
  /** Unix seconds (bucket start). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

/** Last-24h trend for one item: hourly close points + open/high/low. */
export type DaySpark = { points: number[]; open: number; high: number; low: number };
