import { z } from "zod";

/** itemTrading.getPrices → { [itemCode]: price }. */
export const PricesSchema = z.record(z.string(), z.number());
export type Prices = z.infer<typeof PricesSchema>;

/** gameStat.getEquipmentAvgByCode → a single average-quality number. */
export const EquipmentAvgSchema = z.number();

/** workOffer.getWageStats → market labour rate range (params don't affect it). */
export const WageStatsSchema = z
  .object({
    allowedRange: z.object({ min: z.number(), max: z.number(), average: z.number() }),
  })
  .loose();

/** country.getAllCountries → id/name/code + production-bonus inputs. */
export const CountrySchema = z
  .object({
    _id: z.string(),
    name: z.string(),
    code: z.string(),
    productionBonus: z.number().default(0),
    specializedItem: z.string().nullable().default(null),
    incomeTax: z.number().default(0),
    marketTax: z.number().default(0),
    development: z.number().default(0),
  })
  .loose();
export type Country = z.infer<typeof CountrySchema>;

/** battle.getBattles → { items, nextCursor }. */
const BattleSideSchema = z
  .object({
    country: z.string().nullish(),
    region: z.string().nullish(),
    damages: z.number().default(0),
    hitCount: z.number().default(0),
    wonRoundsCount: z.number().default(0),
    // Server sends `mus` (count); `muOrders` kept optional for resilience.
    mus: z.number().default(0),
    muOrders: z.array(z.string()).default([]),
  })
  .loose();
const RoundSideSchema = z
  .object({ points: z.number().default(0), damages: z.number().default(0) })
  .loose();
export const CurrentRoundSchema = z
  .object({
    number: z.number().optional(),
    attacker: RoundSideSchema,
    defender: RoundSideSchema,
    live: z
      .object({
        actualTickPoints: z.number().optional(),
        nextTickAt: z.string().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

export const BattleSchema = z
  .object({
    _id: z.string(),
    attacker: BattleSideSchema,
    defender: BattleSideSchema,
    roundsToWin: z.number().default(2),
    isActive: z.boolean().optional(),
    // String id, number, or the embedded round object — validated in the adapter.
    currentRound: z.unknown().optional(),
  })
  .loose();
export const BattlesPageSchema = z.object({
  items: z.array(BattleSchema),
  nextCursor: z.string().nullable().optional(),
});

/** event.getEventsPaginated → { items, nextCursor }. */
export const EventSchema = z
  .object({
    _id: z.string(),
    countries: z.array(z.string()).default([]),
    createdAt: z.string(),
    data: z.object({ type: z.string() }).loose(),
  })
  .loose();
export const EventsPageSchema = z.object({
  items: z.array(EventSchema),
  nextCursor: z.string().nullable().optional(),
});
export type WrEvent = z.infer<typeof EventSchema>;

/** region.getRegionsObject → { [id]: region }. We use id + code. */
export const RegionSchema = z
  .object({ _id: z.string(), code: z.string().optional(), name: z.string().nullish() })
  .loose();

/** ranking.getRanking → ranked country/user/MU entries. */
export const RankingEntrySchema = z
  .object({
    country: z.string().optional(),
    value: z.number(),
    rank: z.number(),
    tier: z.string().optional(),
  })
  .loose();
export const RankingSchema = z
  .object({ items: z.array(RankingEntrySchema) })
  .loose();

/** tradingOrder.getTopOrders → best buy/sell orders for one item. */
export const TradingOrderSchema = z.object({
  itemCode: z.string(),
  price: z.number(),
  quantity: z.number(),
  type: z.enum(["buy", "sell"]),
  offerAt: z.string().optional(),
});
export const TopOrdersSchema = z.object({
  buyOrders: z.array(TradingOrderSchema),
  sellOrders: z.array(TradingOrderSchema),
});
export type TopOrders = z.infer<typeof TopOrdersSchema>;
