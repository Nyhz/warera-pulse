import { useQuery } from "@tanstack/react-query";
import type { Country, RegionInfo } from "./types";

export type { RegionInfo } from "./types";

/** All countries, indexed by id (server-trimmed to id/name/code + bonus inputs). */
export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const res = await fetch("/api/countries");
      const arr = (await res.json()) as Country[];
      const byId = new Map<string, Country>();
      for (const c of arr) byId.set(c._id, c);
      return byId;
    },
    staleTime: 30 * 60_000,
  });
}

/** All regions, indexed by id → { name, countryCode, countryId }. */
export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const res = await fetch("/api/regions");
      const obj = (await res.json()) as Record<string, RegionInfo>;
      return new Map(Object.entries(obj));
    },
    staleTime: 30 * 60_000,
  });
}
