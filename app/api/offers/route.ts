import type { NextRequest } from "next/server";
import { EQUIPMENT_CODES } from "@/lib/catalog";

/**
 * Equipment floor prices for all 36 codes in ONE batched call to
 * itemOffer.getItemOffers (cheapest offer per item).
 *
 * That endpoint is auth-gated, so the caller passes their own WarEra JWT via
 * `Authorization: Bearer <jwt>` (BYOT). The token only authorizes the upstream
 * call — the offer data is the GLOBAL market, identical for everyone — so the
 * result is cached in memory and served to everyone (even tokenless clients)
 * for the TTL. The token is forwarded to WarEra and never stored or logged.
 */
const API6 = "https://api6.warera.io/trpc";
const TTL = 30_000;

export type OfferStat = {
  floor: number;
  attack: number | null;
  crit: number | null;
  state: number | null;
  count: number;
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

let cache: { at: number; data: Record<string, OfferStat> } | null = null;
let inflight: Promise<Record<string, OfferStat>> | null = null;

async function fetchOffers(token: string): Promise<Record<string, OfferStat>> {
  const path = EQUIPMENT_CODES.map(() => "itemOffer.getItemOffers").join(",");
  const body = JSON.stringify(
    Object.fromEntries(
      EQUIPMENT_CODES.map((code, i) => [i, { itemCode: code, limit: 1, direction: "forward" }]),
    ),
  );
  const res = await fetch(`${API6}/${path}?batch=1`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://app.warera.io",
      cookie: `jwt=${token}`,
    },
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
        count: arr[i]?.result?.data?.items?.length ?? 1,
      };
    }
  });
  return out;
}

export async function GET(req: NextRequest) {
  // Fresh global cache → serve to anyone, no token needed.
  if (cache && Date.now() - cache.at < TTL) return Response.json(cache.data);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    // No token and no fresh cache — nothing we can do.
    return Response.json(cache?.data ?? {}, { status: cache ? 200 : 401 });
  }

  if (!inflight) {
    inflight = fetchOffers(token)
      .then((data) => {
        cache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return Response.json(await inflight);
  } catch {
    return Response.json(cache?.data ?? {}, { status: cache ? 200 : 502 });
  }
}
