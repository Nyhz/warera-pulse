import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { DaySpark } from "@/lib/types";
import { cacheHeaders } from "@/lib/gateway";

/**
 * Last-24h trend for ALL 21 items in one query: hourly close points (for the
 * rail sparklines) + open/high/low (for the chart's 24h stats and % change).
 * The current PRICE is never read from here — it stays live from the 10s
 * snapshot; this only provides the historical trend.
 *
 * Cached via unstable_cache so the DB isn't hit per user.
 */
const REVALIDATE = 300;
const HOURS = 24;

const getSparks = unstable_cache(
  async (): Promise<Record<string, DaySpark>> => {
    if (!supabase) return {};
    const since = new Date(Date.now() - HOURS * 3600 * 1000).toISOString();

    // Fast path: hourly close points + open/high/low computed in Postgres.
    const rpc = await supabase.rpc("price_sparks", { p_since: since });
    if (!rpc.error && Array.isArray(rpc.data)) {
      const out: Record<string, DaySpark> = {};
      for (const r of rpc.data as {
        item_code: string;
        points: number[] | null;
        open: number;
        high: number;
        low: number;
      }[]) {
        out[r.item_code] = { points: r.points ?? [], open: r.open, high: r.high, low: r.low };
      }
      return out;
    }

    // Fallback (function not yet migrated): pull rows and group in JS.
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
  return Response.json(sparks, { headers: cacheHeaders(REVALIDATE) });
}
