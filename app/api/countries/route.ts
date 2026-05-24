import { gatewayQuery } from "@/lib/gateway";

/**
 * Countries trimmed to the only fields the UI uses ({_id,name,code}).
 * The raw country.getAllCountries is ~300 KB; this cuts it ~95% so every client
 * isn't downloading populations/geometry it never reads. Cached 30 min.
 */
const REVALIDATE = 1800;

export type CountryLite = { _id: string; name: string; code: string };

export async function GET() {
  const raw = await gatewayQuery<unknown>("country.getAllCountries", undefined, REVALIDATE);
  const arr = Array.isArray(raw) ? raw : raw ? Object.values(raw as object) : [];
  const out: CountryLite[] = [];
  for (const c of arr) {
    const o = c as { _id?: unknown; name?: unknown; code?: unknown };
    if (o && typeof o._id === "string") {
      out.push({
        _id: o._id,
        name: typeof o.name === "string" ? o.name : "Unknown",
        code: typeof o.code === "string" ? o.code : "??",
      });
    }
  }
  return Response.json(out, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
