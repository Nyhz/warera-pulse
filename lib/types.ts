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

export type PricePoint = {
  /** Unix seconds. */
  time: number;
  value: number;
};

export type Candle = {
  /** Unix seconds (bucket start). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type BattleRole = "attack" | "defend";

export type BattleSide = {
  code: string;
  /** Chip background color. */
  color: string;
  role: BattleRole;
  /** Total damage dealt this round (raw units). */
  damage: number;
  /** Damage share 0–100 (derived from both sides' damage). */
  share: number;
};

export type Battle = {
  id: string;
  /** Battle / front name, e.g. "Brittany". */
  name: string;
  a: BattleSide;
  b: BattleSide;
  round: number;
  tick: number;
  /** Regions of terrain at stake — used for sorting and display. */
  terrain: number;
  /** Military units engaged. */
  mus: number;
  /** Seconds until the next tick resolves. */
  secondsToTick: number;
  /** Momentum: side code gaining + damage per tick (avg over last 5 ticks). */
  momentum: { code: string; perTick: number };
};

/** A nation in the "Hot Nations" 7-day growth board. */
export type HotNation = {
  code: string;
  color: string;
  /** Power/economy score growth over the last 7d as a signed fraction. */
  growth7d: number;
};

export type FeedKind = "market" | "war" | "battle" | "jobs" | "diplomacy";

type FeedBase = { id: string; ts: string; kind: FeedKind };

export type FeedEvent =
  | (FeedBase & { kind: "market"; symbol: string; change: number })
  | (FeedBase & {
      kind: "war";
      from: { code: string; color: string };
      to: { code: string; color: string };
    })
  | (FeedBase & {
      kind: "battle";
      a: { code: string; color: string };
      b: { code: string; color: string };
      round: number;
    })
  | (FeedBase & { kind: "jobs"; count: number; country: { code: string; color: string } })
  | (FeedBase & { kind: "diplomacy"; text: string });
