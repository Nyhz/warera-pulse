/**
 * Single batched snapshot of all live dashboard data.
 *
 * Collapses the whole live data set into ONE tRPC batch call to the WarEra
 * gateway (itemTrading.getPrices, battle.getBattles, event.getEventsPaginated,
 * ranking.getRanking, workOffer.getWageStats, gameConfig.getDates).
 *
 * Cached via Next's Data Cache (`next: { revalidate }`): on Vercel this is
 * shared across all serverless instances and persisted, so the gateway is hit
 * at most once per the revalidate window no matter how many users poll — never
 * per-user. Time-based revalidation also gives stale-while-revalidate for free
 * (serves the last value instantly, refreshes in the background).
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/** Gateway is polled at most once per this window, shared across all clients. */
const REVALIDATE = 10;

const PROCS: { proc: string; input: unknown }[] = [
  { proc: "itemTrading.getPrices", input: {} },
  { proc: "battle.getBattles", input: { isActive: true, limit: 10 } },
  { proc: "event.getEventsPaginated", input: { limit: 30 } },
  { proc: "ranking.getRanking", input: { rankingType: "weeklyCountryDamages" } },
  { proc: "workOffer.getWageStats", input: { energy: 100, production: 100, citizenship: "" } },
  { proc: "gameConfig.getDates", input: {} },
];

export type Snapshot = {
  prices: Record<string, number> | null;
  battles: unknown;
  events: unknown;
  ranking: unknown;
  wage: unknown;
  dates: unknown;
};

const EMPTY: Snapshot = {
  prices: null,
  battles: null,
  events: null,
  ranking: null,
  wage: null,
  dates: null,
};

async function fetchBatch(base: string): Promise<unknown[]> {
  const path = PROCS.map((p) => p.proc).join(",");
  const input = JSON.stringify(Object.fromEntries(PROCS.map((p, i) => [i, p.input])));
  const url = `${base}/${path}?batch=1&input=${encodeURIComponent(input)}`;
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && base !== API2) headers["X-API-Key"] = KEY;
  const res = await fetch(url, { headers, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`snapshot batch ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) throw new Error("snapshot batch: not an array");
  return json;
}

/** Unwrap one tRPC batch entry; null on a per-procedure error. */
function unwrap(arr: unknown[], i: number): unknown {
  const entry = arr[i] as { result?: { data?: unknown }; error?: unknown } | undefined;
  if (!entry || entry.error) return null;
  return entry.result?.data ?? null;
}

export async function GET() {
  let arr: unknown[];
  try {
    arr = await fetchBatch(BASE);
  } catch {
    // If the keyed gateway batch fails outright, fall back to public api2.
    try {
      arr = await fetchBatch(API2);
    } catch {
      return Response.json(EMPTY, { status: 502 });
    }
  }

  const snapshot: Snapshot = {
    prices: unwrap(arr, 0) as Record<string, number> | null,
    battles: unwrap(arr, 1),
    events: unwrap(arr, 2),
    ranking: unwrap(arr, 3),
    wage: unwrap(arr, 4),
    dates: unwrap(arr, 5),
  };

  return Response.json(snapshot, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
