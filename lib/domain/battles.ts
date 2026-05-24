import type { Battle, Country, CurrentRound, RegionInfo } from "@/lib/api/types";

export type LiveBattleSide = {
  code: string;
  name: string;
  damage: number;
  share: number;
  /** Ground points won this round — the scoring metric that decides the battle. */
  ground: number;
  mus: number;
  wonRounds: number;
};
export type LiveBattle = {
  id: string;
  /** Contested region name (the defender's region under attack). */
  region?: string;
  attacker: LiveBattleSide;
  defender: LiveBattleSide;
  roundsToWin: number;
  hitCount: number;
  /** Ground awarded to the winning side at the next tick. */
  tickPoints: number;
  /** ISO timestamp of the next tick (for the countdown). */
  nextTickAt?: string;
  round?: number;
};

/**
 * Map the snapshot's (trimmed) battle items to view-ready `LiveBattle`s,
 * resolving country/region ids to codes + names. Pure — no React, no fetching —
 * so it's unit-testable and reusable. Team/tournament battles (no single
 * country per side) are dropped.
 */
export function toLiveBattles(
  items: Battle[],
  byId?: Map<string, Country>,
  regionById?: Map<string, RegionInfo>,
): LiveBattle[] {
  const name = (countryId?: string | null) => {
    const c = countryId ? byId?.get(countryId) : undefined;
    return { code: c?.code?.toUpperCase() ?? "??", name: c?.name ?? "Unknown" };
  };
  return items
    .filter((b) => typeof b.attacker.country === "string" && typeof b.defender.country === "string")
    .map((b): LiveBattle => {
      // currentRound is the route-trimmed round object, or a string id / null
      // for battles between rounds — narrow before reading it.
      const round =
        b.currentRound && typeof b.currentRound === "object"
          ? (b.currentRound as CurrentRound)
          : null;
      // Cumulative damage across all rounds = completed rounds (top-level) +
      // current round. Keeps a battle visible after a round resets to 0.
      const aDmg = b.attacker.damages + (round?.attacker.damages ?? 0);
      const dDmg = b.defender.damages + (round?.defender.damages ?? 0);
      const total = aDmg + dDmg;
      const aShare = total > 0 ? Math.round((aDmg / total) * 100) : 50;
      const aMeta = name(b.attacker.country);
      const dMeta = name(b.defender.country);
      const regionId = b.defender.region ?? b.attacker.region;
      return {
        id: b._id,
        region: regionId ? regionById?.get(regionId)?.name : undefined,
        attacker: {
          ...aMeta,
          damage: aDmg,
          share: aShare,
          ground: round?.attacker.points ?? 0,
          mus: b.attacker.mus,
          wonRounds: b.attacker.wonRoundsCount,
        },
        defender: {
          ...dMeta,
          damage: dDmg,
          share: 100 - aShare,
          ground: round?.defender.points ?? 0,
          mus: b.defender.mus,
          wonRounds: b.defender.wonRoundsCount,
        },
        roundsToWin: b.roundsToWin,
        hitCount: b.attacker.hitCount + b.defender.hitCount,
        tickPoints: round?.live?.actualTickPoints ?? 0,
        nextTickAt: round?.live?.nextTickAt,
        round: round?.number,
      };
    });
}
