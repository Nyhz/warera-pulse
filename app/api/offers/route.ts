import type { NextRequest } from "next/server";
import { EQUIPMENT_CODES } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";

/**
 * Equipment floor prices for all 36 codes.
 *
 * itemOffer.getItemOffers is auth-gated, so a visitor passes their own WarEra
 * JWT (BYOT) via `Authorization: Bearer <jwt>`. The offer data is the GLOBAL
 * market, so it's persisted in Supabase (`equipment_offers`, one row per item)
 * and served to EVERYONE — including tokenless visitors. A tokened request only
 * refreshes the shared copy when it's gone stale. Tokens are forwarded to
 * WarEra and never stored or logged.
 */
const API6 = "https://api6.warera.io/trpc";
/** Refresh from WarEra at most this often (when a tokened visitor shows up). */
const FRESH_MS = 5 * 60_000;
/** In-memory cache of the DB read, to avoid querying Supabase every request. */
const READ_TTL = 20_000;

export type OfferStat = {
  floor: number;
  attack: number | null;
  crit: number | null;
  state: number | null;
};
type OffersPayload = { offers: Record<string, OfferStat>; updatedAt: string | null };

type UpstreamEntry = {
  result?: {
    data?: {
      items?: Array<{
        price: number;
        item?: { skills?: { attack?: number; criticalChance?: number }; state?: number };
      }>;
    };
  };
};

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

async function fetchFromWarera(token: string): Promise<Record<string, OfferStat>> {
  const path = EQUIPMENT_CODES.map(() => "itemOffer.getItemOffers").join(",");
  const body = JSON.stringify(
    Object.fromEntries(
      EQUIPMENT_CODES.map((code, i) => [i, { itemCode: code, limit: 1, direction: "forward" }]),
    ),
  );
  const res = await fetch(`${API6}/${path}?batch=1`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://app.warera.io", cookie: `jwt=${token}` },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`offers ${res.status}`);
  const arr = (await res.json()) as UpstreamEntry[];
  const out: Record<string, OfferStat> = {};
  EQUIPMENT_CODES.forEach((code, i) => {
    const o = arr[i]?.result?.data?.items?.[0];
    if (o) {
      out[code] = {
        floor: o.price,
        attack: o.item?.skills?.attack ?? null,
        crit: o.item?.skills?.criticalChance ?? null,
        state: o.item?.state ?? null,
      };
    }
  });
  return out;
}

async function refresh(token: string): Promise<OffersPayload> {
  const offers = await fetchFromWarera(token);
  const updatedAt = new Date().toISOString();
  if (supabase && Object.keys(offers).length) {
    const rows = Object.entries(offers).map(([item_code, o]) => ({ item_code, ...o, updated_at: updatedAt }));
    await supabase.from("equipment_offers").upsert(rows, { onConflict: "item_code" });
  }
  return { offers, updatedAt };
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
