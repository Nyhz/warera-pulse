/**
 * Real WarEra item catalog, discovered from api2.warera.io.
 * Economy = the 21 tradeable resources (itemTrading.getPrices).
 * Military = equipment queried per-code via gameStat.getEquipmentAvgByCode
 * (equipment has no order book, so we track average quality, not price).
 */

export type EconItem = { code: string; name: string };

/** The fixed 21 tradeable resources, ordered raws → refined → agri/food → military → cases. */
export const ECONOMY_ITEMS: EconItem[] = [
  { code: "scraps", name: "Scraps" },
  { code: "limestone", name: "Limestone" },
  { code: "iron", name: "Iron" },
  { code: "petroleum", name: "Petroleum" },
  { code: "lead", name: "Lead" },
  { code: "coca", name: "Coca" },
  { code: "concrete", name: "Concrete" },
  { code: "steel", name: "Steel" },
  { code: "oil", name: "Oil" },
  { code: "grain", name: "Grain" },
  { code: "livestock", name: "Livestock" },
  { code: "fish", name: "Fish" },
  { code: "bread", name: "Bread" },
  { code: "steak", name: "Steak" },
  { code: "cookedFish", name: "Cooked Fish" },
  { code: "lightAmmo", name: "Light Ammo" },
  { code: "ammo", name: "Ammo" },
  { code: "heavyAmmo", name: "Heavy Ammo" },
  { code: "cocain", name: "Cocaine" },
  { code: "case1", name: "Case I" },
  { code: "case2", name: "Case II" },
];

export const ECONOMY_CODES = ECONOMY_ITEMS.map((i) => i.code);

/** Flat production bonus for making a country's specialized item (%). */
export const SPECIALIZATION_BONUS = 30;

/**
 * Refining recipes — inputs and production points to make one unit of each
 * product. From gameConfig.items[code].{productionNeeds,productionPoints}
 * (stable game data). `points` is the limiting resource, so the Economy tab's
 * refining calculator ranks by margin per production point.
 */
/**
 * Production points to extract one unit of each raw input (most are 1, but
 * livestock=20 and fish=40). Needed for the Economy tab's "full chain" mode,
 * where producing the inputs yourself also costs production points.
 */
export const RAW_POINTS: Record<string, number> = {
  limestone: 1,
  iron: 1,
  grain: 1,
  lead: 1,
  coca: 1,
  petroleum: 1,
  livestock: 20,
  fish: 40,
};

export const RECIPES: { code: string; needs: Record<string, number>; points: number }[] = [
  { code: "oil", needs: { petroleum: 1 }, points: 1 },
  { code: "concrete", needs: { limestone: 10 }, points: 10 },
  { code: "steel", needs: { iron: 10 }, points: 10 },
  { code: "bread", needs: { grain: 10 }, points: 10 },
  { code: "steak", needs: { livestock: 1 }, points: 20 },
  { code: "cookedFish", needs: { fish: 1 }, points: 40 },
  { code: "lightAmmo", needs: { lead: 1 }, points: 1 },
  { code: "ammo", needs: { lead: 4 }, points: 4 },
  { code: "heavyAmmo", needs: { lead: 16 }, points: 16 },
  { code: "cocain", needs: { coca: 200 }, points: 200 },
];

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

const ITEM_NAME: Record<string, string> = Object.fromEntries(
  ECONOMY_ITEMS.map((i) => [i.code, i.name]),
);
const WEAPON_NAME: Record<string, string> = Object.fromEntries(
  WEAPON_TIERS.map((w) => [w.code, w.name]),
);

/** Display name for a resource code (falls back to a title-cased code). */
export function itemName(code: string): string {
  return ITEM_NAME[code] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

/** Readable label for any traded item — resource, weapon, or armor piece. */
export function itemLabel(code: string): string {
  if (ITEM_NAME[code]) return ITEM_NAME[code];
  if (WEAPON_NAME[code]) return WEAPON_NAME[code];
  const m = code.match(/^([a-z]+)(\d)$/i); // armor: helmet4 → Helmet T4
  if (m) return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} T${m[2]}`;
  return code;
}
