import { gatewayQuery } from "@/lib/gateway";

/**
 * Regions trimmed to an `{ [id]: displayName }` map. The raw
 * region.getRegionsObject is ~700 KB; we only need id → name, so this cuts it
 * to a few KB. Display name is derived from the region code. Cached 30 min.
 */
const REVALIDATE = 1800;

function regionDisplay(code?: string, name?: string | null): string {
  if (name) return name;
  if (!code) return "";
  const parts = code.split("-");
  const rest = parts.length > 1 ? parts.slice(1) : parts;
  return rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function GET() {
  const raw = await gatewayQuery<Record<string, unknown>>(
    "region.getRegionsObject",
    undefined,
    REVALIDATE,
  );
  const out: Record<string, string> = {};
  for (const v of Object.values(raw ?? {})) {
    const o = v as { _id?: unknown; code?: unknown; name?: unknown };
    if (o && typeof o._id === "string") {
      out[o._id] = regionDisplay(
        typeof o.code === "string" ? o.code : undefined,
        typeof o.name === "string" ? o.name : undefined,
      );
    }
  }
  return Response.json(out, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
