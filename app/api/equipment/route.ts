import { EQUIPMENT_CODES } from "@/lib/catalog";

/**
 * Average quality for every equipment code (3 weapons + 5×6 armor = 33),
 * fetched as ONE tRPC batch call to gameStat.getEquipmentAvgByCode instead of
 * 33 separate requests. Shared + cached via Next's Data Cache.
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);
const REVALIDATE = 10;

async function fetchBatch(base: string): Promise<unknown[]> {
  const path = EQUIPMENT_CODES.map(() => "gameStat.getEquipmentAvgByCode").join(",");
  const input = JSON.stringify(
    Object.fromEntries(EQUIPMENT_CODES.map((code, i) => [i, { itemCode: code }])),
  );
  const url = `${base}/${path}?batch=1&input=${encodeURIComponent(input)}`;
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && base !== API2) headers["X-API-Key"] = KEY;
  const res = await fetch(url, { headers, next: { revalidate: REVALIDATE } });
  if (!res.ok) throw new Error(`equipment batch ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) throw new Error("equipment batch: not an array");
  return json;
}

export async function GET() {
  let arr: unknown[];
  try {
    arr = await fetchBatch(BASE);
  } catch {
    try {
      arr = await fetchBatch(API2);
    } catch {
      return Response.json({}, { status: 502 });
    }
  }

  const out: Record<string, number> = {};
  EQUIPMENT_CODES.forEach((code, i) => {
    const entry = arr[i] as { result?: { data?: unknown }; error?: unknown } | undefined;
    const v = entry && !entry.error ? entry.result?.data : undefined;
    if (typeof v === "number" && Number.isFinite(v)) out[code] = v;
  });

  return Response.json(out, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
