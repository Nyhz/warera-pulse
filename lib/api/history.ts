import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Candle, DaySpark } from "@/lib/types";
import { bucketCandles } from "@/lib/util/ohlc";
import { useHistory } from "@/lib/store/history";

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
    const candles =
      db && db.length >= 2
        ? db
        : bucketCandles(session ?? [], TF_BUCKET[tf], (p) => p.t, (p) => p.v);
    const open = candles[0]?.open ?? 0;
    const last = candles[candles.length - 1]?.close ?? 0;
    const high = candles.length ? Math.max(...candles.map((c) => c.high)) : 0;
    const low = candles.length ? Math.min(...candles.map((c) => c.low)) : 0;
    const change = open > 0 ? (last - open) / open : 0;
    return { candles, open, high, low, last, change };
  }, [db, session, tf]);
}
