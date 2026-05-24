import { supabase } from "@/lib/supabase";
import type { OfferStat } from "@/lib/offers";

/**
 * Equipment prices for all 36 codes, read from the shared `equipment_offers`
 * table (populated by the cron via the gateway key — see /api/ingest). No token,
 * instant read; served to everyone.
 */
const REVALIDATE = 20;
let cache: { at: number; offers: Record<string, OfferStat> } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < REVALIDATE * 1000) {
    return Response.json({ offers: cache.offers });
  }
  if (!supabase) return Response.json({ offers: {} });

  const { data, error } = await supabase
    .from("equipment_offers")
    .select("item_code, floor, attack, crit, state");
  const offers: Record<string, OfferStat> = {};
  if (!error && data) {
    for (const r of data as Array<{
      item_code: string;
      floor: number;
      attack: number | null;
      crit: number | null;
      state: number | null;
    }>) {
      offers[r.item_code] = { price: r.floor, attack: r.attack, crit: r.crit, state: r.state };
    }
  }
  cache = { at: Date.now(), offers };
  return Response.json(
    { offers },
    {
      headers: {
        "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
      },
    },
  );
}
