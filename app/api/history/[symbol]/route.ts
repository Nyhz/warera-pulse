import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Candle } from "@/lib/types";

/**
 * 7-day price history for one item as HOURLY OHLC candles, reconstructed from
 * the ~10-min snapshots ingested into Supabase (open = first sample of the
 * hour, close = last, high/low = extremes). The live current price keeps
 * coming from the 15s snapshot — this only feeds the chart's historical bars.
 *
 * Cached via unstable_cache (shared across instances, revalidated periodically)
 * so the DB isn't queried per user.
 */
const DAYS = 7;
const REVALIDATE = 300;

const getCandles = unstable_cache(
  async (symbol: string): Promise<Candle[]> => {
    if (!supabase) return [];
    const since = new Date(Date.now() - DAYS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("price_history")
      .select("ts, price")
      .eq("item_code", symbol)
      .gte("ts", since)
      .order("ts", { ascending: true })
      .limit(5000);
    if (error || !data) return [];

    // Bucket to the hour. Rows are oldest→newest, so first seen = open,
    // last seen = close; track running high/low.
    const byHour = new Map<number, Candle>();
    for (const r of data as { ts: string; price: number }[]) {
      const sec = Math.floor(new Date(r.ts).getTime() / 1000);
      const time = sec - (sec % 3600);
      const cur = byHour.get(time);
      if (!cur) {
        byHour.set(time, { time, open: r.price, high: r.price, low: r.price, close: r.price });
      } else {
        cur.high = Math.max(cur.high, r.price);
        cur.low = Math.min(cur.low, r.price);
        cur.close = r.price;
      }
    }
    return [...byHour.values()].sort((a, b) => a.time - b.time);
  },
  ["price-history"],
  { revalidate: REVALIDATE },
);

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const candles = await getCandles(symbol);
  return Response.json(
    { candles },
    {
      headers: {
        "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
      },
    },
  );
}
