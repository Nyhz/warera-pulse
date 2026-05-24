import type { Battle, Country, CurrentRound, RegionInfo } from "@/lib/api/types";

export type LiveBattleSide = {
  code: string;
  name: string;
  /** Damage dealt in the CURRENT round (what the card shows), not all-time. */
  damage: number;
  /** Damage share of the current round (0–100). */
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
  /** Cumulative damage across ALL rounds — used only to gate/sort Hot Conflicts. */
  totalDamage: number;
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
      // The card shows damage for the CURRENT round only (share follows it).
      const aRound = round?.attacker.damages ?? 0;
      const dRound = round?.defender.damages ?? 0;
      const roundTotal = aRound + dRound;
      const aShare = roundTotal > 0 ? Math.round((aRound / roundTotal) * 100) : 50;
      // Whole-battle damage (completed rounds + current) gates Hot Conflicts, so
      // a battle stays listed even when the current round just reset to ~0.
      const totalDamage =
        b.attacker.damages + b.defender.damages + roundTotal;
      const aMeta = name(b.attacker.country);
      const dMeta = name(b.defender.country);
      const regionId = b.defender.region ?? b.attacker.region;
      return {
        id: b._id,
        region: regionId ? regionById?.get(regionId)?.name : undefined,
        attacker: {
          ...aMeta,
          damage: aRound,
          share: aShare,
          ground: round?.attacker.points ?? 0,
          mus: b.attacker.mus,
          wonRounds: b.attacker.wonRoundsCount,
        },
        defender: {
          ...dMeta,
          damage: dRound,
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
        totalDamage,
      };
    });
}
