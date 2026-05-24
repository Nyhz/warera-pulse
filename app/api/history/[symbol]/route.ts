import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Candle } from "@/lib/types";
import { bucketCandles } from "@/lib/util/ohlc";
import { cacheHeaders } from "@/lib/gateway";

/**
 * Price history for one item as OHLC candles, reconstructed from the ~10-min
 * snapshots ingested into Supabase (open = first sample of the bucket, close =
 * last, high/low = extremes). Timeframe via `?tf`:
 *   week  → 7 days,  1h candles
 *   month → 30 days, 12h candles
 * The live current price keeps coming from the 10s snapshot — this only feeds
 * the chart's historical bars.
 *
 * Cached via unstable_cache (shared across instances, revalidated periodically)
 * so the DB isn't queried per user.
 */
const REVALIDATE = 300;
const TF: Record<string, { days: number; bucket: number }> = {
  week: { days: 7, bucket: 3600 }, // 1h
  month: { days: 30, bucket: 12 * 3600 }, // 12h
};

const getCandles = unstable_cache(
  async (symbol: string, tf: string): Promise<Candle[]> => {
    if (!supabase) return [];
    const { days, bucket } = TF[tf] ?? TF.week;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    // Fast path: bucket into OHLC candles in Postgres (one small result set).
    const rpc = await supabase.rpc("price_candles", {
      p_symbol: symbol,
      p_since: since,
      p_bucket: bucket,
    });
    if (!rpc.error && Array.isArray(rpc.data)) {
      return (rpc.data as { t: number; open: number; high: number; low: number; close: number }[])
        .map((r) => ({ time: Number(r.t), open: r.open, high: r.high, low: r.low, close: r.close }));
    }

    // Fallback (function not yet migrated): pull rows and bucket in JS.
    const { data, error } = await supabase
      .from("price_history")
      .select("ts, price")
      .eq("item_code", symbol)
      .gte("ts", since)
      .order("ts", { ascending: true })
      .limit(10000);
    if (error || !data) return [];
    // Rows are oldest→newest, so first seen = open, last seen = close.
    return bucketCandles(
      data as { ts: string; price: number }[],
      bucket,
      (r) => Math.floor(new Date(r.ts).getTime() / 1000),
      (r) => r.price,
    );
  },
  ["price-history"],
  { revalidate: REVALIDATE },
);

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const tf = new URL(req.url).searchParams.get("tf") === "month" ? "month" : "week";
  const candles = await getCandles(symbol, tf);
  return Response.json({ candles }, { headers: cacheHeaders(REVALIDATE) });
}
