"use client";

import { useState } from "react";

/**
 * Equipment icon: a single base webp per slot/weapon composited on a
 * tier-colored background — exactly how the game renders gear. Armor codes are
 * `${slot}${tier}` (e.g. helmet4); weapons are named per tier (knife=1 … jet=6).
 */
const WEAPON_TIER: Record<string, number> = {
  knife: 1,
  gun: 2,
  rifle: 3,
  sniper: 4,
  tank: 5,
  jet: 6,
};

// T1 white · T2 green · T3 blue · T4 purple · T5 gold · T6 red.
const TIER_BG: Record<number, string> = {
  1: "#e9edf3",
  2: "#3fb950",
  3: "#3b6fd6",
  4: "#7d5fd0",
  5: "#d29922",
  6: "#f85149",
};

/** Resolve an item code to its base icon name + tier, or null if not gear. */
export function parseEquipment(code: string): { base: string; tier: number } | null {
  if (WEAPON_TIER[code]) return { base: code, tier: WEAPON_TIER[code] };
  const m = code.match(/^(helmet|chest|pants|boots|gloves)([1-6])$/);
  if (m) return { base: m[1], tier: Number(m[2]) };
  return null;
}

export function EquipmentIcon({ code, className = "" }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const eq = parseEquipment(code);
  if (!eq) return null;
  const bg = TIER_BG[eq.tier] ?? "#1a2230";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[3px] ${className}`}
      style={{ background: bg }}
      title={`Tier ${eq.tier}`}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/items/${eq.base}.webp`}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-[1px]"
        />
      ) : null}
    </span>
  );
}
