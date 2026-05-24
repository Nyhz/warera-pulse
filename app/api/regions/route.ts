import { gatewayQuery } from "@/lib/gateway";

/**
 * Regions trimmed to `{ [id]: { name, countryCode, countryId } }`. The raw
 * region.getRegionsObject is ~700 KB; we keep only what the UI needs:
 *   - name        — display name (falls back to a title-cased code)
 *   - countryCode — owning country's ISO code (for the flag)
 *   - countryId   — owning country's id (to look up its production bonus)
 * Cached 30 min.
 */
const REVALIDATE = 1800;

function regionDisplay(code?: string, name?: string | null): string {
  if (name) return name;
  if (!code) return "";
  const parts = code.split("-");
  const rest = parts.length > 1 ? parts.slice(1) : parts;
  return rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

type RegionInfo = { name: string; countryCode: string; countryId: string | null };

export async function GET() {
  const raw = await gatewayQuery<Record<string, unknown>>(
    "region.getRegionsObject",
    undefined,
    REVALIDATE,
  );
  const out: Record<string, RegionInfo> = {};
  for (const v of Object.values(raw ?? {})) {
    const o = v as {
      _id?: unknown;
      code?: unknown;
      name?: unknown;
      countryCode?: unknown;
      country?: unknown;
    };
    if (o && typeof o._id === "string") {
      out[o._id] = {
        name: regionDisplay(
          typeof o.code === "string" ? o.code : undefined,
          typeof o.name === "string" ? o.name : undefined,
        ),
        countryCode: typeof o.countryCode === "string" ? o.countryCode : "",
        countryId: typeof o.country === "string" ? o.country : null,
      };
    }
  }
  return Response.json(out, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
