/**
 * Shapes of the WarEra API responses the client reads. These are plain TS
 * types, not runtime schemas: the data either comes from our own server routes
 * (which already trim/normalize it — see /api/snapshot, /api/countries, …) or
 * is normalized at the one external edge (`useTopOrders`). Runtime validation
 * lives server-side; the client trusts the shapes it controls.
 */

/** itemTrading.getPrices → { [itemCode]: price }. */
export type Prices = Record<string, number>;

/** country.getAllCountries → id/name/code + production-bonus inputs. */
export type Country = {
  _id: string;
  name: string;
  code: string;
  productionBonus: number;
  specializedItem: string | null;
  incomeTax: number;
  marketTax: number;
  development: number;
};

/** One side of a battle (server-trimmed: all fields defaulted in /api/snapshot). */
type BattleSide = {
  country?: string | null;
  region?: string | null;
  damages: number;
  hitCount: number;
  wonRoundsCount: number;
  mus: number;
};
type RoundSide = { points: number; damages: number };
export type CurrentRound = {
  number?: number;
  attacker: RoundSide;
  defender: RoundSide;
  live?: { actualTickPoints?: number; nextTickAt?: string };
};
export type Battle = {
  _id: string;
  attacker: BattleSide;
  defender: BattleSide;
  roundsToWin: number;
  /** String id, number, or the embedded round object — narrowed in the adapter. */
  currentRound?: unknown;
};

/** event.getEventsPaginated item (server-trimmed: countries always an array). */
export type WrEvent = {
  _id: string;
  countries: string[];
  createdAt: string;
  data: { type: string } & Record<string, unknown>;
};

/** region.getRegionsObject (trimmed) → per-region name + owning country. */
export type RegionInfo = { name: string; countryCode: string; countryId: string | null };

/** ranking.getRanking entry (server-trimmed to country/value/rank). */
export type RankingEntry = {
  country?: string;
  value: number;
  rank: number;
  tier?: string;
};

/** tradingOrder.getTopOrders → best buy/sell orders for one item. */
type TradingOrder = {
  itemCode: string;
  price: number;
  quantity: number;
  type: "buy" | "sell";
  offerAt?: string;
};
export type TopOrders = { buyOrders: TradingOrder[]; sellOrders: TradingOrder[] };
