/**
 * Real WarEra item catalog, discovered from api2.warera.io.
 * Economy = the 21 tradeable resources (itemTrading.getPrices).
 * Military = equipment queried per-code via gameStat.getEquipmentAvgByCode
 * (equipment has no order book, so we track average quality, not price).
 */

export type EconItem = { code: string; name: string };

/** The fixed 21 tradeable resources, grouped industrials → agri/food → military → cases. */
export const ECONOMY_ITEMS: EconItem[] = [
  { code: "oil", name: "Oil" },
  { code: "iron", name: "Iron" },
  { code: "lead", name: "Lead" },
  { code: "limestone", name: "Limestone" },
  { code: "petroleum", name: "Petroleum" },
  { code: "concrete", name: "Concrete" },
  { code: "steel", name: "Steel" },
  { code: "scraps", name: "Scraps" },
  { code: "grain", name: "Grain" },
  { code: "livestock", name: "Livestock" },
  { code: "fish", name: "Fish" },
  { code: "bread", name: "Bread" },
  { code: "steak", name: "Steak" },
  { code: "cookedFish", name: "Cooked Fish" },
  { code: "coca", name: "Coca" },
  { code: "cocain", name: "Cocaine" },
  { code: "lightAmmo", name: "Light Ammo" },
  { code: "heavyAmmo", name: "Heavy Ammo" },
  { code: "ammo", name: "Ammo" },
  { code: "case1", name: "Case I" },
  { code: "case2", name: "Case II" },
];

export const ECONOMY_CODES = ECONOMY_ITEMS.map((i) => i.code);

export type ArmorSlot = "helmet" | "chest" | "pants" | "boots" | "gloves";

/** Weapon tiers T1–T6 (named items, ascending quality). */
export const WEAPON_TIERS: { code: string; tier: number; name: string }[] = [
  { code: "knife", tier: 1, name: "Knife" },
  { code: "gun", tier: 2, name: "Gun" },
  { code: "rifle", tier: 3, name: "Rifle" },
  { code: "sniper", tier: 4, name: "Sniper" },
  { code: "tank", tier: 5, name: "Tank" },
  { code: "jet", tier: 6, name: "Jet" },
];

/** 5 armor slots, each with tiers 1–6 (code = `${slot}${tier}`). */
export const ARMOR_SLOTS: { slot: ArmorSlot; name: string }[] = [
  { slot: "helmet", name: "Helmet" },
  { slot: "chest", name: "Chest" },
  { slot: "pants", name: "Pants" },
  { slot: "boots", name: "Boots" },
  { slot: "gloves", name: "Gloves" },
];

export const ARMOR_TIERS = [1, 2, 3, 4, 5, 6] as const;

export function armorCode(slot: ArmorSlot, tier: number): string {
  return `${slot}${tier}`;
}

/** Every equipment code we track (6 weapons + 5×6 armor = 36). */
export const EQUIPMENT_CODES: string[] = [
  ...WEAPON_TIERS.map((w) => w.code),
  ...ARMOR_SLOTS.flatMap((s) => ARMOR_TIERS.map((t) => armorCode(s.slot, t))),
];
