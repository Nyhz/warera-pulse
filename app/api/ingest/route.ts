import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { ECONOMY_CODES } from "@/lib/catalog";
import { chunkForRun, fetchEquipmentPrices, persistOffers } from "@/lib/offers";

// The rotating equipment slice can take ~15s on the gateway; allow headroom.
export const maxDuration = 60;

/**
 * Scheduled ingestion (cron-job.org, ~every 10min) with
 * `Authorization: Bearer <INGEST_SECRET>`:
 *  - appends a price snapshot for the 21 resources to `price_history`, and
 *  - refreshes the shared `equipment_offers` table with last-traded equipment
 *    prices (gateway key, no token — the slow 36-code transaction batch runs
 *    here in the background so user requests just read the table).
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);
const SECRET = process.env.INGEST_SECRET?.trim();
/** Keep this many days of history; older rows are pruned on each ingest. */
const RETENTION_DAYS = 30;

async function fetchPrices(): Promise<Record<string, number>> {
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && BASE !== API2) headers["X-API-Key"] = KEY;
  const res = await fetch(`${BASE}/itemTrading.getPrices`, { headers, cache: "no-store" });
  const json = (await res.json()) as { result?: { data?: Record<string, number> } };
  return json.result?.data ?? {};
}

export async function POST(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const token = bearer || req.nextUrl.searchParams.get("secret");
  if (!SECRET || token !== SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!supabase) {
    return Response.json({ error: "supabase not configured" }, { status: 500 });
  }

  const prices = await fetchPrices();
  const ts = new Date().toISOString();
  const rows = ECONOMY_CODES.filter(
    (code) => typeof prices[code] === "number" && Number.isFinite(prices[code]),
  ).map((code) => ({ item_code: code, ts, price: prices[code] }));

  if (rows.length === 0) {
    return Response.json({ inserted: 0, ts, note: "no prices returned" });
  }

  const { error } = await supabase.from("price_history").insert(rows);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Retention: prune rows older than the window so the table stays bounded.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  await supabase.from("price_history").delete().lt("ts", cutoff);

  // Refresh ONE rotating slice of equipment prices (full set every ~30min).
  // Best-effort; never blocks the price ingest.
  let offers = 0;
  try {
    const prices = await fetchEquipmentPrices(chunkForRun());
    await persistOffers(prices);
    offers = Object.keys(prices).length;
  } catch {
    /* leave existing equipment_offers in place */
  }

  return Response.json({ inserted: rows.length, ts, offers });
}
