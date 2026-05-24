import { useQuery } from "@tanstack/react-query";
import { wrFetch } from "./client";
import type { TopOrders } from "./types";
import { POLL } from "./config";

/**
 * Normalize the raw tradingOrder.getTopOrders payload. This is the one client
 * read that hits the gateway through a passthrough proxy (not our trimmed
 * routes), so it's the only place we still guard the external shape — done with
 * plain checks rather than pulling Zod into the client bundle.
 */
function asOrders(v: unknown): TopOrders["buyOrders"] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
    .map((o) => ({
      itemCode: typeof o.itemCode === "string" ? o.itemCode : "",
      price: typeof o.price === "number" ? o.price : 0,
      quantity: typeof o.quantity === "number" ? o.quantity : 0,
      type: o.type === "sell" ? "sell" : "buy",
      offerAt: typeof o.offerAt === "string" ? o.offerAt : undefined,
    }));
}
function asTopOrders(raw: unknown): TopOrders {
  const o = (raw ?? {}) as { buyOrders?: unknown; sellOrders?: unknown };
  return { buyOrders: asOrders(o.buyOrders), sellOrders: asOrders(o.sellOrders) };
}

/** Average market price for every equipment code (one batched call). */
export function useEquipmentAvgs(enabled = true) {
  return useQuery({
    queryKey: ["equipmentAvgs"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/equipment");
      return (await res.json()) as Record<string, number>;
    },
    staleTime: POLL,
    refetchInterval: POLL,
  });
}

export type MarketTx = {
  id: string;
  code: string;
  type: string;
  quantity: number;
  money: number;
  createdAt: string;
};

/** Latest item-market fills for the transactions feed (own 10s-cached route). */
export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async (): Promise<MarketTx[]> => {
      const res = await fetch("/api/transactions");
      const json = (await res.json()) as { items?: MarketTx[] };
      return json.items ?? [];
    },
    staleTime: POLL,
    refetchInterval: POLL,
  });
}

/** Best buy/sell orders for one resource (for spread + BUY/SELL pressure). */
export function useTopOrders(itemCode: string, enabled = true) {
  return useQuery({
    queryKey: ["topOrders", itemCode],
    queryFn: async () =>
      asTopOrders(await wrFetch("tradingOrder.getTopOrders", { itemCode, limit: 8 })),
    enabled: enabled && !!itemCode,
    staleTime: POLL,
    refetchInterval: POLL,
  });
}
