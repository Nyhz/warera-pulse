import { gatewayQuery } from "@/lib/gateway";

/**
 * Latest market fills for the live transactions feed — BOTH resource trades
 * (transactionType "trading") and equipment fills ("itemMarket"), merged by
 * time. Buyer/seller ids are resolved to usernames via a batched
 * user.getUserLite call so the feed can show who traded.
 *
 * Own route (not in the snapshot batch): batching transactions with other
 * procs is pathologically slow on the gateway; single calls are ~150ms.
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

const REVALIDATE = 15;
/** How many of each transaction type to pull. Kept small: every trade adds up
 * to two ids to the username-resolution batch, and large same-proc batches are
 * what made this route slow (~10s). 8+8 → ~12 rows after merge. */
const PER_TYPE = 8;
/** Rows kept after merging both types. */
const MAX_ROWS = 12;

type RawTx = {
  _id?: string;
  itemCode?: string;
  quantity?: number;
  money?: number;
  createdAt?: string;
  buyerId?: string;
  sellerId?: string;
  item?: { type?: string };
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Long-lived username cache (per serverless instance). Resolving buyer/seller
 * ids is the expensive part: a cold `user.getUserLite` lookup is slow, and a
 * batch of ~48 distinct cold ids took ~9s (occasionally 30s+). Usernames never
 * change, so we keep them an hour. The win is steady state: across 15s polls
 * the same active traders recur, so we only resolve the few genuinely NEW ids
 * each time instead of re-batching every participant.
 */
const nameCache = new Map<string, { name: string; exp: number }>();
const NAME_TTL_MS = 60 * 60 * 1000;

/** Resolve ids → usernames, serving cached ones and batch-fetching only misses. */
async function resolveNames(ids: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const hit = nameCache.get(id);
    if (hit && hit.exp > now) out[id] = hit.name;
    else missing.push(id);
  }
  if (missing.length === 0) return out;
  const fetched = await fetchNames(missing);
  for (const id of missing) {
    const name = fetched[id];
    if (name) {
      nameCache.set(id, { name, exp: now + NAME_TTL_MS });
      out[id] = name;
    }
  }
  return out;
}

/** Batch-resolve user ids → usernames in one same-proc tRPC call. */
async function fetchNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const path = ids.map(() => "user.getUserLite").join(",");
  const input = JSON.stringify(Object.fromEntries(ids.map((id, i) => [i, { userId: id }])));
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && BASE !== API2) headers["X-API-Key"] = KEY;
  const res = await fetch(`${BASE}/${path}?batch=1&input=${encodeURIComponent(input)}`, {
    headers,
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) return {};
  const arr = (await res.json()) as { result?: { data?: { username?: string } } }[];
  const out: Record<string, string> = {};
  if (Array.isArray(arr)) {
    ids.forEach((id, i) => {
      const u = arr[i]?.result?.data;
      if (u?.username) out[id] = u.username;
    });
  }
  return out;
}

export async function GET() {
  const [resourceTx, gearTx] = await Promise.all([
    gatewayQuery<{ items?: RawTx[] }>(
      "transaction.getPaginatedTransactions",
      { transactionType: "trading", limit: PER_TYPE },
      REVALIDATE,
    ),
    gatewayQuery<{ items?: RawTx[] }>(
      "transaction.getPaginatedTransactions",
      { transactionType: "itemMarket", limit: PER_TYPE },
      REVALIDATE,
    ),
  ]);

  const merged = [...(resourceTx?.items ?? []), ...(gearTx?.items ?? [])]
    .filter((t) => t && t.itemCode)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, MAX_ROWS);

  // Resolve the unique buyers/sellers to usernames in one batched call.
  const ids = [...new Set(merged.flatMap((t) => [t.buyerId, t.sellerId]).filter(Boolean) as string[])];
  const names = await resolveNames(ids);

  const items = merged.map((t) => ({
    id: t._id ?? "",
    code: t.itemCode ?? "",
    type: t.item?.type ?? "resource",
    quantity: num(t.quantity),
    money: num(t.money),
    createdAt: t.createdAt ?? "",
    buyer: (t.buyerId && names[t.buyerId]) || null,
    seller: (t.sellerId && names[t.sellerId]) || null,
  }));

  return Response.json(
    { items },
    {
      headers: {
        "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
      },
    },
  );
}
