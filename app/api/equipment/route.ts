import { EQUIPMENT_CODES } from "@/lib/catalog";
import { API2, cacheHeaders, gatewayBatch } from "@/lib/gateway";

/**
 * Average quality for every equipment code (3 weapons + 5×6 armor = 33),
 * fetched as ONE tRPC batch call to gameStat.getEquipmentAvgByCode instead of
 * 33 separate requests. Shared + cached via Next's Data Cache.
 */
const REVALIDATE = 10;

const ENTRIES = EQUIPMENT_CODES.map((code) => ({
  proc: "gameStat.getEquipmentAvgByCode",
  input: { itemCode: code },
}));

export async function GET() {
  let arr: unknown[];
  try {
    arr = await gatewayBatch(ENTRIES, REVALIDATE);
  } catch {
    try {
      arr = await gatewayBatch(ENTRIES, REVALIDATE, API2);
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

  return Response.json(out, { headers: cacheHeaders(REVALIDATE) });
}
