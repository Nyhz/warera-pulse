import { gatewayQuery } from "@/lib/gateway";

/**
 * Latest market fills for the live transactions feed — BOTH resource trades
 * (transactionType "trading") and equipment fills ("itemMarket"), merged by
 * time.
 *
 * Buyer/seller are intentionally NOT shown: the only way to get a name from an
 * id is a `user.getUserLite` lookup, and resolving every distinct participant
 * each poll made this route spike to 10–30s on cold ids. Trades alone are
 * ~150ms, so the feed just shows time · item · qty · price.
 *
 * Own route (not in the snapshot batch): batching transactions with other
 * procs is pathologically slow on the gateway; single calls are ~150ms.
 */
const REVALIDATE = 10;
/** How many of each transaction type to pull before merging by time. */
const PER_TYPE = 18;
/** Rows kept after merging both types. */
const MAX_ROWS = 30;

type RawTx = {
  _id?: string;
  itemCode?: string;
  quantity?: number;
  money?: number;
  createdAt?: string;
  item?: { type?: string };
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export async function GET() {
  const [resourceTx, gearTx] = await Promise.all([
    gatewayQuery<{ items?: RawTx[] }>(
      "transaction.getPaginatedTransactions",
      { transactionType: "trading", limit: PER_TYPE },
      REVALIDATE,
    ),
    gatewayQuery<{ items?: RawTx[] }>(
      "transaction.getPaginatedTransactions",
      { transactionType: "itemMarket", limit: PER_TYPE },
      REVALIDATE,
    ),
  ]);

  const merged = [...(resourceTx?.items ?? []), ...(gearTx?.items ?? [])]
    .filter((t) => t && t.itemCode)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, MAX_ROWS);

  const items = merged.map((t) => ({
    id: t._id ?? "",
    code: t.itemCode ?? "",
    type: t.item?.type ?? "resource",
    quantity: num(t.quantity),
    money: num(t.money),
    createdAt: t.createdAt ?? "",
  }));

  return Response.json(
    { items },
    {
      headers: {
        "cache-control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=${REVALIDATE * 2}`,
      },
    },
  );
}
