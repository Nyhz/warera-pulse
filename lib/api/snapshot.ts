import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Battle, Country, Prices, RankingEntry, WrEvent } from "./types";
import { ECONOMY_ITEMS } from "@/lib/catalog";
import type { Item } from "@/lib/types";
import { useHistory } from "@/lib/store/history";
import { POLL } from "./config";
import { useCountries, useRegions, type RegionInfo } from "./reference";
import { useDaySparks } from "./history";
import { toLiveBattles, type LiveBattle } from "@/lib/domain/battles";
import { toHotNations, type HotNation } from "@/lib/domain/nations";

// Re-exported so panels can keep importing view types from the snapshot module.
export type { LiveBattle, LiveBattleSide } from "@/lib/domain/battles";
export type { HotNation } from "@/lib/domain/nations";

type RawSnapshot = {
  prices: Record<string, number> | null;
  battles: unknown;
  events: unknown;
  ranking: unknown;
  wage: unknown;
};

type WageRange = { min: number; max: number; average: number };

/** The snapshot after one-time validation — what every live panel reads. */
type ParsedSnapshot = {
  prices?: Prices;
  battles: Battle[];
  events: WrEvent[];
  ranking: RankingEntry[];
  wage?: WageRange;
};

/**
 * The whole live dashboard in one cached, batched gateway call. Every live
 * panel derives from this single query, so one poll updates the entire UI.
 * On each fetch we append the observed prices to the in-memory session history
 * that powers the line chart and rail sparklines.
 *
 * Validation happens ONCE per poll in `select` (React Query memoizes its result
 * by the raw data reference), so panels read already-parsed, typed slices
 * instead of each re-running Zod on every render.
 */
function useSnapshot() {
  return useQuery({
    queryKey: ["snapshot"],
    queryFn: async (): Promise<RawSnapshot> => {
      const res = await fetch("/api/snapshot");
      const json = (await res.json()) as RawSnapshot;
      if (json.prices) useHistory.getState().push(json.prices);
      return json;
    },
    // The data is shaped by our own /api/snapshot route (trimmed + defaulted
    // server-side), so the client trusts it with light casts instead of Zod.
    select: (raw): ParsedSnapshot => ({
      prices: raw.prices ?? undefined,
      battles: (raw.battles as { items?: Battle[] } | null)?.items ?? [],
      events: (raw.events as { items?: WrEvent[] } | null)?.items ?? [],
      ranking: (raw.ranking as { items?: RankingEntry[] } | null)?.items ?? [],
      wage: (raw.wage as { allowedRange?: WageRange } | null)?.allowedRange,
    }),
    staleTime: POLL,
    refetchInterval: POLL,
  });
}

/** Current prices for all 21 resources (derived from the snapshot). */
export function useItemPrices() {
  const q = useSnapshot();
  return { data: q.data?.prices, isError: q.isError, isLoading: q.isLoading };
}

/**
 * The 21 economy resources as UI `Item`s: live price (10s snapshot) + 24h
 * sparkline and change from the ingested DB. The live price is appended as the
 * sparkline's last point so its tip and the % change stay live every 10s.
 */
export function useEconomyItems(): {
  items: Item[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useSnapshot();
  const sparks = useDaySparks();
  const prices = data?.prices;
  const sparkData = sparks.data;
  const items = useMemo(
    () =>
      ECONOMY_ITEMS.map(({ code, name }): Item => {
        const price = prices?.[code] ?? 0;
        const day = sparkData?.[code];
        const base = day?.points ?? [];
        // Append the live price so the sparkline ends "now" and updates at 10s.
        const spark = price > 0 ? [...base, price] : base;
        const open = day?.open ?? base[0] ?? 0;
        const change = open > 0 && price > 0 ? (price - open) / open : 0;
        return { symbol: code, name, price, change24h: change, spark };
      }),
    [prices, sparkData],
  );
  return { items, isLoading, isError };
}

/** Market labour rates (min/avg/max wage) — from the snapshot. */
export function useWageStats() {
  const q = useSnapshot();
  return { data: q.data?.wage, isError: q.isError, isLoading: q.isLoading };
}

/** Active battles, with country refs resolved to codes/names (from snapshot). */
export function useLiveBattles(): {
  battles: LiveBattle[];
  isLoading: boolean;
  isError: boolean;
} {
  const countries = useCountries();
  const regions = useRegions();
  const q = useSnapshot();

  const byId = countries.data;
  const regionById = regions.data;
  const battleItems = q.data?.battles;
  const battles = useMemo<LiveBattle[]>(
    () => (battleItems ? toLiveBattles(battleItems, byId, regionById) : []),
    [battleItems, byId, regionById],
  );

  return { battles, isLoading: q.isLoading, isError: q.isError };
}

/** Hot nations: weekly country damage leaderboard, resolved to codes. */
export function useHotNations(limit = 6): {
  nations: HotNation[];
  isLoading: boolean;
} {
  const countries = useCountries();
  const q = useSnapshot();

  const byId = countries.data;
  const ranking = q.data?.ranking;
  const nations = useMemo<HotNation[]>(
    () => (ranking ? toHotNations(ranking, byId, limit) : []),
    [ranking, byId, limit],
  );

  return { nations, isLoading: q.isLoading };
}

/** Global event feed + the country/region maps needed to render it. */
export function useFeed(): {
  events: WrEvent[];
  countriesById?: Map<string, Country>;
  regionsById?: Map<string, RegionInfo>;
  isLoading: boolean;
  isError: boolean;
} {
  const countries = useCountries();
  const regions = useRegions();
  const q = useSnapshot();
  return {
    events: q.data?.events ?? [],
    countriesById: countries.data,
    regionsById: regions.data,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}
