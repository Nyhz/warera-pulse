import { EQUIPMENT_CODES } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";

/**
 * Equipment "market price" = most recent `itemMarket` transaction (actual fill)
 * per code, via the WARERA_API_KEY — no user JWT/BYOT. `itemOffer` (listings)
 * is JWT-gated; transactions are unlocked by the gateway key.
 *
 * The 36-code transaction batch is slow on the gateway (~sequential), so it's
 * run in the background cron (/api/ingest) in parallel chunks and persisted to
 * Supabase `equipment_offers`; /api/offers just reads that table (instant).
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/**
 * The gateway serializes transaction queries (~0.7s each), so all 36 at once
 * is ~30s — too long for one function/cron invocation. Each cron run refreshes
 * one rotating slice of this size instead → full set refreshed every
 * (36/OFFER_CHUNK) runs (~30 min at one run / 10 min). Equipment moves slowly.
 */
export const OFFER_CHUNK = 12;

/** The slice of equipment codes to refresh on this run (rotates over time). */
export function chunkForRun(): string[] {
  const chunks = Math.ceil(EQUIPMENT_CODES.length / OFFER_CHUNK);
  const idx = Math.floor(Date.now() / (10 * 60 * 1000)) % chunks;
  return EQUIPMENT_CODES.slice(idx * OFFER_CHUNK, idx * OFFER_CHUNK + OFFER_CHUNK);
}

export type OfferStat = {
  /** Average unit price of recent itemMarket fills (like warerastats' avgPrice). */
  price: number;
  attack: number | null;
  crit: number | null;
  state: number | null;
};

/** Recent itemMarket transactions to average per item (newest first). */
const SAMPLE = 10;

type TxItem = {
  money?: number;
  quantity?: number;
  item?: { skills?: { attack?: number; criticalChance?: number }; state?: number };
};

/**
 * One item's recent-price stats. Uses a SEPARATE request per item (the gateway
 * serializes anyway, ~0.7s each, but its multi-proc *batch* of transaction
 * queries is pathologically slow — >50s for 12). Callers run these in parallel.
 */
async function fetchOne(code: string): Promise<OfferStat | null> {
  const input = encodeURIComponent(
    JSON.stringify({ itemCode: code, limit: SAMPLE, transactionType: "itemMarket", direction: "forward" }),
  );
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && BASE !== API2) headers["X-API-Key"] = KEY;
  const res = await fetch(`${BASE}/transaction.getPaginatedTransactions?input=${input}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { data?: { items?: TxItem[] } } };
  const items = json.result?.data?.items ?? [];
  const prices = items
    .map((t) => (typeof t.money === "number" ? t.money / (t.quantity && t.quantity > 0 ? t.quantity : 1) : null))
    .filter((p): p is number => p != null);
  if (prices.length === 0) return null;
  const recent = items[0];
  return {
    price: prices.reduce((a, b) => a + b, 0) / prices.length,
    attack: recent.item?.skills?.attack ?? null,
    crit: recent.item?.skills?.criticalChance ?? null,
    state: recent.item?.state ?? null,
  };
}

/** Recent-price stats for the given equipment codes (parallel, one req each). */
export async function fetchEquipmentPrices(codes: string[]): Promise<Record<string, OfferStat>> {
  const results = await Promise.all(codes.map(fetchOne));
  const out: Record<string, OfferStat> = {};
  codes.forEach((code, i) => {
    if (results[i]) out[code] = results[i]!;
  });
  return out;
}

/** Upsert into `equipment_offers` (price stored in the `floor` column). */
export async function persistOffers(offers: Record<string, OfferStat>): Promise<void> {
  if (!supabase || Object.keys(offers).length === 0) return;
  const updated_at = new Date().toISOString();
  const rows = Object.entries(offers).map(([item_code, o]) => ({
    item_code,
    floor: o.price,
    attack: o.attack,
    crit: o.crit,
    state: o.state,
    updated_at,
  }));
  await supabase.from("equipment_offers").upsert(rows, { onConflict: "item_code" });
}
