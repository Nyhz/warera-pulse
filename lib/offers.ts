import { EQUIPMENT_CODES } from "@/lib/catalog";
import { supabase } from "@/lib/supabase";

/**
 * Equipment market floor prices via the auth-gated itemOffer.getItemOffers.
 * Shared by the BYOT route (/api/offers) and the scheduled refresh (/api/ingest
 * with a server-side WARERA_JWT), both writing the same global `equipment_offers`.
 */
const API6 = "https://api6.warera.io/trpc";

export type OfferStat = {
  floor: number;
  attack: number | null;
  crit: number | null;
  state: number | null;
};

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

/** Fetch the cheapest offer per equipment code (one batched call to WarEra). */
export async function fetchEquipmentOffers(token: string): Promise<Record<string, OfferStat>> {
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

/** Upsert offers into the shared `equipment_offers` table (≤36 rows). */
export async function persistOffers(offers: Record<string, OfferStat>): Promise<void> {
  if (!supabase || Object.keys(offers).length === 0) return;
  const updated_at = new Date().toISOString();
  const rows = Object.entries(offers).map(([item_code, o]) => ({ item_code, ...o, updated_at }));
  await supabase.from("equipment_offers").upsert(rows, { onConflict: "item_code" });
}
