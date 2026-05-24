import type { NextRequest } from "next/server";

/**
 * Generic proxy to the WarEra tRPC API for the few endpoints that aren't part
 * of the batched /api/snapshot (the static country/region maps and per-item
 * top orders).
 *
 * - Hides the upstream + key from the browser (key stays server-side).
 * - Caches via Next's Data Cache (`next: { revalidate }`): shared across all
 *   serverless instances on Vercel and persisted, so the gateway is hit at most
 *   once per the proc's TTL regardless of how many users poll — never per-user.
 *   Time-based revalidation also gives stale-while-revalidate (serves the last
 *   value instantly, refreshes in the background).
 *
 * With a key set, everything routes through the gateway. Without one, it uses
 * the public api2 endpoints.
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/** Revalidate window (seconds) per procedure. Long for static reference data. */
const CACHE_TTL: Record<string, number> = {
  "country.getAllCountries": 1800,
  "region.getRegionsObject": 1800,
  "tradingOrder.getTopOrders": 10,
  "gameConfig.getDates": 300,
};
const DEFAULT_TTL = 15;

async function fetchUpstream(
  base: string,
  proc: string,
  input: string | null,
  ttl: number,
): Promise<Response> {
  const url = new URL(`${base}/${proc}`);
  if (input) url.searchParams.set("input", input);
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && base !== API2) headers["X-API-Key"] = KEY;
  return fetch(url, { headers, next: { revalidate: ttl } });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ proc: string }> },
) {
  const { proc } = await params;
  const input = req.nextUrl.searchParams.get("input");
  const ttl = CACHE_TTL[proc] ?? DEFAULT_TTL;

  let res = await fetchUpstream(BASE, proc, input, ttl);
  let body = await res.text();
  let status = res.status;

  // The gateway whitelists methods; for ones it doesn't proxy ("unknown
  // method"), fall back to the public api2 endpoint.
  if (KEY && BASE !== API2 && body.includes("unknown method")) {
    res = await fetchUpstream(API2, proc, input, ttl);
    body = await res.text();
    status = res.status;
  }

  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
    },
  });
}
