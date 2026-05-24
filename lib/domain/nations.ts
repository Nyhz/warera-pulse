import type { Country, RankingEntry } from "@/lib/api/types";

export type HotNation = { code: string; name: string; value: number };

/**
 * Map weekly country-damage ranking entries to view-ready `HotNation`s,
 * resolving country ids to codes + names. Pure and unit-testable.
 */
export function toHotNations(
  ranking: RankingEntry[],
  byId?: Map<string, Country>,
  limit = 6,
): HotNation[] {
  return ranking
    .filter((e) => e.country)
    .slice(0, limit)
    .map((e) => {
      const c = byId?.get(e.country!);
      return {
        code: c?.code?.toUpperCase() ?? "??",
        name: c?.name ?? "Unknown",
        value: e.value,
      };
    });
}
