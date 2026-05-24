import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

/**
 * Last-24h trend for ALL 21 items in one query: hourly close points (for the
 * rail sparklines) + open/high/low (for the chart's 24h stats and % change).
 * The current PRICE is never read from here — it stays live from the 15s
 * snapshot; this only provides the historical trend.
 *
 * Cached via unstable_cache so the DB isn't hit per user.
 */
const REVALIDATE = 300;
const HOURS = 24;

export type DaySpark = { points: number[]; open: number; high: number; low: number };

const getSparks = unstable_cache(
  async (): Promise<Record<string, DaySpark>> => {
    if (!supabase) return {};
    const since = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("price_history")
      .select("item_code, ts, price")
      .gte("ts", since)
      .order("ts", { ascending: true })
      .limit(20000);
    if (error || !data) return {};

    // Group by item; rows are oldest→newest so first seen = open. Hourly
    // buckets keep the last price per hour (close) for the sparkline shape.
    const acc = new Map<
      string,
      { hours: Map<number, number>; open: number; high: number; low: number }
    >();
    for (const r of data as { item_code: string; ts: string; price: number }[]) {
      const sec = Math.floor(new Date(r.ts).getTime() / 1000);
      const hour = sec - (sec % 3600);
      let e = acc.get(r.item_code);
      if (!e) {
        e = { hours: new Map(), open: r.price, high: r.price, low: r.price };
        acc.set(r.item_code, e);
      }
      e.hours.set(hour, r.price);
      e.high = Math.max(e.high, r.price);
      e.low = Math.min(e.low, r.price);
    }

    const out: Record<string, DaySpark> = {};
    for (const [code, e] of acc) {
      const points = [...e.hours.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      out[code] = { points, open: e.open, high: e.high, low: e.low };
    }
    return out;
  },
  ["spark-24h"],
  { revalidate: REVALIDATE },
);

export async function GET() {
  const sparks = await getSparks();
  return Response.json(sparks, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
