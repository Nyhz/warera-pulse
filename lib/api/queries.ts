import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { wrFetch } from "./client";
import {
  BattlesPageSchema,
  CurrentRoundSchema,
  EventsPageSchema,
  GameDatesSchema,
  PricesSchema,
  RankingSchema,
  TopOrdersSchema,
  WageStatsSchema,
  type Country,
  type WrEvent,
} from "./schemas";
import { ECONOMY_ITEMS } from "@/lib/catalog";
import type { Candle, Item } from "@/lib/types";
import { useHistory } from "@/lib/store/history";

/** Single client poll cadence — the whole UI refreshes on this interval. */
const POLL = 15_000;

export type LiveBattleSide = {
  code: string;
  name: string;
  damage: number;
  share: number;
  /** Ground points won this round — the scoring metric that decides the battle. */
  ground: number;
  mus: number;
  wonRounds: number;
};
export type LiveBattle = {
  id: string;
  /** Contested region name (the defender's region under attack). */
  region?: string;
  attacker: LiveBattleSide;
  defender: LiveBattleSide;
  roundsToWin: number;
  hitCount: number;
  /** Ground awarded to the winning side at the next tick. */
  tickPoints: number;
  /** ISO timestamp of the next tick (for the countdown). */
  nextTickAt?: string;
  round?: number;
};

export type HotNation = { code: string; name: string; value: number };

type RawSnapshot = {
  prices: Record<string, number> | null;
  battles: unknown;
  events: unknown;
  ranking: unknown;
  wage: unknown;
  dates: unknown;
};

/**
 * The whole live dashboard in one cached, batched gateway call. Every live
 * panel derives from this single query, so one poll updates the entire UI.
 * On each fetch we append the observed prices to the in-memory session history
 * that powers the line chart and rail sparklines.
 */
function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot"],
    queryFn: async (): Promise<RawSnapshot> => {
      const res = await fetch("/api/snapshot");
      const json = (await res.json()) as RawSnapshot;
      if (json.prices) useHistory.getState().push(json.prices);
      return json;
    },
    staleTime: POLL,
    refetchInterval: POLL,
  });
}

/** Current prices for all 21 resources (derived from the snapshot). */
export function useItemPrices() {
  const q = useSnapshot();
  return {
    data: q.data?.prices ? PricesSchema.parse(q.data.prices) : undefined,
    isError: q.isError,
    isLoading: q.isLoading,
  };
}

export type DaySpark = { points: number[]; open: number; high: number; low: number };

/** Last-24h trend for all items (hourly closes + open/high/low) from the DB. */
export function useDaySparks() {
  return useQuery({
    queryKey: ["spark24h"],
    queryFn: async () => {
      const res = await fetch("/api/spark");
      return (await res.json()) as Record<string, DaySpark>;
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/**
 * The 21 economy resources as UI `Item`s: live price (15s snapshot) + 24h
 * sparkline and change from the ingested DB. The live price is appended as the
 * sparkline's last point so its tip and the % change stay live every 15s.
 */
export function useEconomyItems(): {
  items: Item[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useSnapshot();
  const sparks = useDaySparks();
  const prices = data?.prices;
  const sparkData = sparks.data;
  const items = useMemo(
    () =>
      ECONOMY_ITEMS.map(({ code, name }): Item => {
        const price = prices?.[code] ?? 0;
        const day = sparkData?.[code];
        const base = day?.points ?? [];
        // Append the live price so the sparkline ends "now" and updates at 15s.
        const spark = price > 0 ? [...base, price] : base;
        const open = day?.open ?? base[0] ?? 0;
        const change = open > 0 && price > 0 ? (price - open) / open : 0;
        return { symbol: code, name, price, change24h: change, spark };
      }),
    [prices, sparkData],
  );
  return { items, isLoading, isError };
}

export type ItemHistory = {
  candles: Candle[];
  open: number;
  high: number;
  low: number;
  last: number;
  change: number;
};

export type Timeframe = "week" | "month";

/** Candle interval (seconds) per timeframe — must match /api/history's TF map. */
const TF_BUCKET: Record<Timeframe, number> = { week: 3600, month: 12 * 3600 };

/** Bucket raw {t,v} session points into OHLC candles of `bucket` seconds. */
function bucketCandles(pts: { t: number; v: number }[], bucket: number): Candle[] {
  const byBucket = new Map<number, Candle>();
  for (const p of pts) {
    const time = p.t - (p.t % bucket);
    const cur = byBucket.get(time);
    if (!cur) byBucket.set(time, { time, open: p.v, high: p.v, low: p.v, close: p.v });
    else {
      cur.high = Math.max(cur.high, p.v);
      cur.low = Math.min(cur.low, p.v);
      cur.close = p.v;
    }
  }
  return [...byBucket.values()].sort((a, b) => a.time - b.time);
}

/**
 * Price history for one item as OHLC candles from the ingested DB
 * (`/api/history`), per timeframe (week = 7d/1h, month = 30d/12h). Falls back
 * to the live session buffer (bucketed) until the DB has data.
 */
export function useItemHistory(symbol?: string, tf: Timeframe = "week"): ItemHistory {
  const session = useHistory((s) => (symbol ? s.series[symbol] : undefined));
  const q = useQuery({
    queryKey: ["history", symbol, tf],
    enabled: !!symbol,
    queryFn: async () => {
      const res = await fetch(`/api/history/${symbol}?tf=${tf}`);
      const json = (await res.json()) as { candles: Candle[] };
      return json.candles ?? [];
    },
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const db = q.data;
  return useMemo(() => {
    const candles = db && db.length >= 2 ? db : bucketCandles(session ?? [], TF_BUCKET[tf]);
    const open = candles[0]?.open ?? 0;
    const last = candles[candles.length - 1]?.close ?? 0;
    const high = candles.length ? Math.max(...candles.map((c) => c.high)) : 0;
    const low = candles.length ? Math.min(...candles.map((c) => c.low)) : 0;
    const change = open > 0 ? (last - open) / open : 0;
    return { candles, open, high, low, last, change };
  }, [db, session, tf]);
}

/** Market labour rates (min/avg/max wage) — from the snapshot. */
export function useWageStats() {
  const q = useSnapshot();
  const wage = q.data?.wage;
  const parsed = wage ? WageStatsSchema.safeParse(wage) : null;
  const data = parsed?.success ? parsed.data.allowedRange : undefined;
  return { data, isError: q.isError, isLoading: q.isLoading };
}

/** Game-day boundaries / server clock anchor — from the snapshot. */
export function useGameDates() {
  const q = useSnapshot();
  const dates = q.data?.dates;
  const parsed = dates ? GameDatesSchema.safeParse(dates) : null;
  const data = parsed?.success ? parsed.data : undefined;
  return { data, isError: q.isError, isLoading: q.isLoading };
}

/** Average market price for every equipment code (one batched call). */
export function useEquipmentAvgs(enabled = true) {
  return useQuery({
    queryKey: ["equipmentAvgs"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/equipment");
      return (await res.json()) as Record<string, number>;
    },
    staleTime: POLL,
    refetchInterval: POLL,
  });
}

/** All countries, indexed by id (server-trimmed to id/name/code). */
export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const res = await fetch("/api/countries");
      const arr = (await res.json()) as Country[];
      const byId = new Map<string, Country>();
      for (const c of arr) byId.set(c._id, c);
      return byId;
    },
    staleTime: 30 * 60_000,
  });
}

/** All regions, indexed by id → display name (server-trimmed map). */
export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const res = await fetch("/api/regions");
      const obj = (await res.json()) as Record<string, string>;
      return new Map(Object.entries(obj));
    },
    staleTime: 30 * 60_000,
  });
}

/** Active battles, with country refs resolved to codes/names (from snapshot). */
export function useLiveBattles(): {
  battles: LiveBattle[];
  isLoading: boolean;
  isError: boolean;
} {
  const countries = useCountries();
  const regions = useRegions();
  const q = useSnapshot();

  const byId = countries.data;
  const regionById = regions.data;
  const rawBattles = q.data?.battles;
  const battles = useMemo<LiveBattle[]>(() => {
    if (!rawBattles) return [];
    const parsed = BattlesPageSchema.safeParse(rawBattles);
    if (!parsed.success) return [];
    const name = (countryId?: string | null) => {
      const c = countryId ? byId?.get(countryId) : undefined;
      return { code: c?.code?.toUpperCase() ?? "??", name: c?.name ?? "Unknown" };
    };
    return parsed.data.items
      // Skip team/tournament battles (no single country per side).
      .filter((b) => typeof b.attacker.country === "string" && typeof b.defender.country === "string")
      .map((b): LiveBattle => {
        const cr = CurrentRoundSchema.safeParse(b.currentRound);
        const round = cr.success ? cr.data : null;
        // Cumulative damage across all rounds = completed rounds (top-level)
        // + current round. Keeps a battle visible after a round resets to 0.
        const aDmg = b.attacker.damages + (round?.attacker.damages ?? 0);
        const dDmg = b.defender.damages + (round?.defender.damages ?? 0);
        const total = aDmg + dDmg;
        const aShare = total > 0 ? Math.round((aDmg / total) * 100) : 50;
        const aMeta = name(b.attacker.country);
        const dMeta = name(b.defender.country);
        const regionId = b.defender.region ?? b.attacker.region;
        return {
          id: b._id,
          region: regionId ? regionById?.get(regionId) : undefined,
          attacker: {
            ...aMeta,
            damage: aDmg,
            share: aShare,
            ground: round?.attacker.points ?? 0,
            mus: b.attacker.mus,
            wonRounds: b.attacker.wonRoundsCount,
          },
          defender: {
            ...dMeta,
            damage: dDmg,
            share: 100 - aShare,
            ground: round?.defender.points ?? 0,
            mus: b.defender.mus,
            wonRounds: b.defender.wonRoundsCount,
          },
          roundsToWin: b.roundsToWin,
          hitCount: b.attacker.hitCount + b.defender.hitCount,
          tickPoints: round?.live?.actualTickPoints ?? 0,
          nextTickAt: round?.live?.nextTickAt,
          round: round?.number,
        };
      });
  }, [rawBattles, byId, regionById]);

  return { battles, isLoading: q.isLoading, isError: q.isError };
}

/** Hot nations: weekly country damage leaderboard, resolved to codes. */
export function useHotNations(limit = 6): {
  nations: HotNation[];
  isLoading: boolean;
} {
  const countries = useCountries();
  const q = useSnapshot();

  const byId = countries.data;
  const rawRanking = q.data?.ranking;
  const nations = useMemo<HotNation[]>(() => {
    if (!rawRanking) return [];
    const parsed = RankingSchema.safeParse(rawRanking);
    if (!parsed.success) return [];
    return parsed.data.items
      .filter((e) => e.country)
      .slice(0, limit)
      .map((e) => {
        const c = byId?.get(e.country!);
        return {
          code: c?.code?.toUpperCase() ?? "??",
          name: c?.name ?? "Unknown",
          value: e.value,
        };
      });
  }, [rawRanking, byId, limit]);

  return { nations, isLoading: q.isLoading };
}

/** Global event feed + the country/region maps needed to render it. */
export function useFeed(): {
  events: WrEvent[];
  countriesById?: Map<string, Country>;
  regionsById?: Map<string, string>;
  isLoading: boolean;
  isError: boolean;
} {
  const countries = useCountries();
  const regions = useRegions();
  const q = useSnapshot();
  const rawEvents = q.data?.events;
  const events = useMemo<WrEvent[]>(() => {
    if (!rawEvents) return [];
    const parsed = EventsPageSchema.safeParse(rawEvents);
    return parsed.success ? parsed.data.items : [];
  }, [rawEvents]);
  return {
    events,
    countriesById: countries.data,
    regionsById: regions.data,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}

/** Best buy/sell orders for one resource (for spread + BUY/SELL pressure). */
export function useTopOrders(itemCode: string, enabled = true) {
  return useQuery({
    queryKey: ["topOrders", itemCode],
    queryFn: async () =>
      TopOrdersSchema.parse(
        await wrFetch("tradingOrder.getTopOrders", { itemCode, limit: 8 }),
      ),
    enabled: enabled && !!itemCode,
    staleTime: POLL,
    refetchInterval: POLL,
  });
}
