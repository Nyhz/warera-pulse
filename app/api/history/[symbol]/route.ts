import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Candle } from "@/lib/types";

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
    const { data, error } = await supabase
      .from("price_history")
      .select("ts, price")
      .eq("item_code", symbol)
      .gte("ts", since)
      .order("ts", { ascending: true })
      .limit(10000);
    if (error || !data) return [];

    // Bucket by the timeframe's interval. Rows are oldest→newest, so first
    // seen = open, last seen = close; track running high/low.
    const byBucket = new Map<number, Candle>();
    for (const r of data as { ts: string; price: number }[]) {
      const sec = Math.floor(new Date(r.ts).getTime() / 1000);
      const time = sec - (sec % bucket);
      const cur = byBucket.get(time);
      if (!cur) {
        byBucket.set(time, { time, open: r.price, high: r.price, low: r.price, close: r.price });
      } else {
        cur.high = Math.max(cur.high, r.price);
        cur.low = Math.min(cur.low, r.price);
        cur.close = r.price;
      }
    }
    return [...byBucket.values()].sort((a, b) => a.time - b.time);
  },
  ["price-history"],
  { revalidate: REVALIDATE },
);

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const tf = new URL(req.url).searchParams.get("tf") === "month" ? "month" : "week";
  const candles = await getCandles(symbol, tf);
  return Response.json(
    { candles },
    {
      headers: {
        "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
      },
    },
  );
}
