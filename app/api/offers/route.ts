import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchEquipmentOffers, persistOffers, type OfferStat } from "@/lib/offers";

/**
 * Equipment floor prices for all 36 codes.
 *
 * itemOffer.getItemOffers is auth-gated, so a visitor passes their own WarEra
 * JWT (BYOT) via `Authorization: Bearer <jwt>`. The offer data is the GLOBAL
 * market, so it's persisted in Supabase (`equipment_offers`, one row per item)
 * and served to EVERYONE — including tokenless visitors. A tokened request only
 * refreshes the shared copy when it's gone stale. Tokens are forwarded to
 * WarEra and never stored or logged.
 *
 * (The same shared table is also kept fresh without any visitor when a
 * server-side WARERA_JWT is configured — see /api/ingest.)
 */
/** Refresh from WarEra at most this often (when a tokened visitor shows up). */
const FRESH_MS = 5 * 60_000;
/** In-memory cache of the DB read, to avoid querying Supabase every request. */
const READ_TTL = 20_000;

type OffersPayload = { offers: Record<string, OfferStat>; updatedAt: string | null };

let readCache: { at: number; payload: OffersPayload } | null = null;

async function readPersisted(): Promise<OffersPayload> {
  if (!supabase) return { offers: {}, updatedAt: null };
  const { data, error } = await supabase
    .from("equipment_offers")
    .select("item_code, floor, attack, crit, state, updated_at");
  if (error || !data) return { offers: {}, updatedAt: null };
  const offers: Record<string, OfferStat> = {};
  let latest: string | null = null;
  for (const r of data as Array<{
    item_code: string;
    floor: number;
    attack: number | null;
    crit: number | null;
    state: number | null;
    updated_at: string;
  }>) {
    offers[r.item_code] = { floor: r.floor, attack: r.attack, crit: r.crit, state: r.state };
    if (!latest || r.updated_at > latest) latest = r.updated_at;
  }
  return { offers, updatedAt: latest };
}

async function refresh(token: string): Promise<OffersPayload> {
  const offers = await fetchEquipmentOffers(token);
  await persistOffers(offers);
  return { offers, updatedAt: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  let persisted: OffersPayload;
  if (readCache && Date.now() - readCache.at < READ_TTL) {
    persisted = readCache.payload;
  } else {
    persisted = await readPersisted();
    readCache = { at: Date.now(), payload: persisted };
  }

  const ageMs = persisted.updatedAt ? Date.now() - new Date(persisted.updatedAt).getTime() : Infinity;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  // Stale (or empty) and we have a token → refresh the shared copy from WarEra.
  if (ageMs > FRESH_MS && token) {
    try {
      const fresh = await refresh(token);
      readCache = { at: Date.now(), payload: fresh };
      return Response.json(fresh);
    } catch {
      /* fall through to whatever we have */
    }
  }
  return Response.json(persisted);
}
