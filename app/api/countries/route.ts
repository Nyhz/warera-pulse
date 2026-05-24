import { gatewayQuery } from "@/lib/gateway";

/**
 * Countries trimmed to the fields the UI uses. The raw country.getAllCountries
 * is ~300 KB; this cuts it ~95%. Besides id/name/code we keep the two inputs to
 * a company's regional production bonus:
 *   - productionBonus  — strategicResources.bonuses.productionPercent (applies
 *     to ALL production in the country)
 *   - specializedItem  — producing this item adds a flat +30% specialization
 * Cached 30 min.
 */
const REVALIDATE = 1800;

/** Flat specialization bonus for producing a country's specialized item (%). */
export const SPECIALIZATION_BONUS = 30;

export type CountryLite = {
  _id: string;
  name: string;
  code: string;
  productionBonus: number;
  specializedItem: string | null;
};

export async function GET() {
  const raw = await gatewayQuery<unknown>("country.getAllCountries", undefined, REVALIDATE);
  const arr = Array.isArray(raw) ? raw : raw ? Object.values(raw as object) : [];
  const out: CountryLite[] = [];
  for (const c of arr) {
    const o = c as {
      _id?: unknown;
      name?: unknown;
      code?: unknown;
      specializedItem?: unknown;
      strategicResources?: { bonuses?: { productionPercent?: unknown } };
    };
    if (o && typeof o._id === "string") {
      const pp = o.strategicResources?.bonuses?.productionPercent;
      out.push({
        _id: o._id,
        name: typeof o.name === "string" ? o.name : "Unknown",
        code: typeof o.code === "string" ? o.code : "??",
        productionBonus: typeof pp === "number" && Number.isFinite(pp) ? pp : 0,
        specializedItem: typeof o.specializedItem === "string" ? o.specializedItem : null,
      });
    }
  }
  return Response.json(out, {
    headers: {
      "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
    },
  });
}
