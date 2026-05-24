/**
 * Single batched snapshot of all live dashboard data.
 *
 * Collapses the whole live data set into ONE tRPC batch call to the WarEra
 * gateway (itemTrading.getPrices, battle.getBattles, event.getEventsPaginated,
 * ranking.getRanking, workOffer.getWageStats).
 *
 * Cached via Next's Data Cache (`next: { revalidate }`): on Vercel this is
 * shared across all serverless instances and persisted, so the gateway is hit
 * at most once per the revalidate window no matter how many users poll — never
 * per-user. Time-based revalidation also gives stale-while-revalidate for free
 * (serves the last value instantly, refreshes in the background).
 */
import { API2, cacheHeaders, gatewayBatch } from "@/lib/gateway";

/** Gateway is polled at most once per this window, shared across all clients. */
const REVALIDATE = 10;

const PROCS: { proc: string; input: unknown }[] = [
  { proc: "itemTrading.getPrices", input: {} },
  // Fetch all active battles (not just 10) — getBattles isn't ordered by
  // damage, so a low limit can drop a high-damage fight from Hot Conflicts.
  { proc: "battle.getBattles", input: { isActive: true, limit: 40 } },
  { proc: "event.getEventsPaginated", input: { limit: 30 } },
  { proc: "ranking.getRanking", input: { rankingType: "weeklyCountryDamages" } },
  { proc: "workOffer.getWageStats", input: { energy: 100, production: 100, citizenship: "" } },
];

export type Snapshot = {
  prices: Record<string, number> | null;
  battles: unknown;
  events: unknown;
  ranking: unknown;
  wage: unknown;
};

const EMPTY: Snapshot = {
  prices: null,
  battles: null,
  events: null,
  ranking: null,
  wage: null,
};

/** Unwrap one tRPC batch entry; null on a per-procedure error. */
function unwrap(arr: unknown[], i: number): unknown {
  const entry = arr[i] as { result?: { data?: unknown }; error?: unknown } | undefined;
  if (!entry || entry.error) return null;
  return entry.result?.data ?? null;
}

// --- Server-side trimming: the raw snapshot is ~174 KB/poll (battles carry
// hundreds of muOrder ids + unused fields, ranking has 180 rows). The UI uses a
// small subset, so we strip it here before sending it every 10s. ---

type RawSide = {
  country?: string | null;
  region?: string | null;
  damages?: number;
  hitCount?: number;
  wonRoundsCount?: number;
  muOrders?: unknown[];
};
type RawRoundSide = { points?: number; damages?: number };
type RawRound = {
  number?: number;
  attacker?: RawRoundSide;
  defender?: RawRoundSide;
  live?: { actualTickPoints?: number; nextTickAt?: string };
};
type RawBattle = {
  _id: string;
  roundsToWin?: number;
  attacker?: RawSide;
  defender?: RawSide;
  currentRound?: unknown;
};

function leanSide(s?: RawSide) {
  return {
    country: s?.country ?? null,
    region: s?.region ?? null,
    damages: s?.damages ?? 0,
    hitCount: s?.hitCount ?? 0,
    wonRoundsCount: s?.wonRoundsCount ?? 0,
    mus: Array.isArray(s?.muOrders) ? s.muOrders.length : 0,
  };
}

function leanRound(r: unknown): unknown {
  if (!r || typeof r !== "object") return r ?? null;
  const round = r as RawRound;
  return {
    number: round.number,
    attacker: { points: round.attacker?.points ?? 0, damages: round.attacker?.damages ?? 0 },
    defender: { points: round.defender?.points ?? 0, damages: round.defender?.damages ?? 0 },
    live: round.live
      ? { actualTickPoints: round.live.actualTickPoints, nextTickAt: round.live.nextTickAt }
      : undefined,
  };
}

function leanBattles(raw: unknown): unknown {
  const items = (raw as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return raw;
  return {
    items: items.map((b) => {
      const battle = b as RawBattle;
      return {
        _id: battle._id,
        roundsToWin: battle.roundsToWin,
        attacker: leanSide(battle.attacker),
        defender: leanSide(battle.defender),
        currentRound: leanRound(battle.currentRound),
      };
    }),
  };
}

function leanRanking(raw: unknown): unknown {
  const items = (raw as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return raw;
  return {
    items: items.slice(0, 15).map((e) => {
      const entry = e as { country?: string; value?: number; rank?: number };
      return { country: entry.country, value: entry.value, rank: entry.rank };
    }),
  };
}

/**
 * Trim events to {_id, countries, createdAt, data}. `data` is kept WHOLE (the
 * feed reads many type-specific fields from it); we only guarantee `countries`
 * is an array so the client can read it without per-event validation.
 */
function leanEvents(raw: unknown): unknown {
  const items = (raw as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return raw;
  return {
    items: items.map((e) => {
      const ev = e as { _id?: string; countries?: unknown; createdAt?: string; data?: unknown };
      return {
        _id: ev._id,
        countries: Array.isArray(ev.countries) ? ev.countries : [],
        createdAt: ev.createdAt,
        data: ev.data ?? { type: "unknown" },
      };
    }),
  };
}

/**
 * Last good value per snapshot field — resilience against gateway flaps. Each
 * field falls back independently, so one erroring proc never blanks a panel
 * that still has good data. Errors are never stored.
 *
 * BEST-EFFORT ONLY: in-memory per serverless instance — not shared across
 * instances, not preserved across cold starts. The shared Next Data Cache is
 * the durable layer; this just cushions back-to-back flaps on a warm instance.
 */
const lastGoodSnapshot: Partial<Record<keyof Snapshot, unknown>> = {};

function mergeLastGood(fresh: Snapshot): Snapshot {
  const out = { ...EMPTY };
  for (const k of Object.keys(fresh) as (keyof Snapshot)[]) {
    const v = fresh[k];
    if (v != null) {
      lastGoodSnapshot[k] = v;
      (out as Record<string, unknown>)[k] = v;
    } else {
      (out as Record<string, unknown>)[k] = lastGoodSnapshot[k] ?? null;
    }
  }
  return out;
}

export async function GET() {
  let arr: unknown[] | null = null;
  try {
    arr = await gatewayBatch(PROCS, REVALIDATE);
  } catch {
    // If the keyed gateway batch fails outright, fall back to public api2.
    try {
      arr = await gatewayBatch(PROCS, REVALIDATE, API2);
    } catch {
      arr = null;
    }
  }

  const fresh: Snapshot = arr
    ? {
        prices: unwrap(arr, 0) as Record<string, number> | null,
        battles: leanBattles(unwrap(arr, 1)),
        events: leanEvents(unwrap(arr, 2)),
        ranking: leanRanking(unwrap(arr, 3)),
        wage: unwrap(arr, 4),
      }
    : EMPTY;

  // Serve fresh fields, backfilling any that errored with the last good value.
  const snapshot = mergeLastGood(fresh);

  return Response.json(snapshot, { headers: cacheHeaders(REVALIDATE) });
}
