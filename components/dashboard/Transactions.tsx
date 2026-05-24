"use client";

import { useState } from "react";
import { useTransactions, type MarketTx } from "@/lib/api/queries";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { ItemIcon } from "@/components/ui/ItemIcon";
import { EquipmentIcon } from "@/components/ui/EquipmentIcon";
import { LoadMore } from "@/components/ui/LoadMore";
import { useIsMobile } from "@/lib/hooks";
import { ECONOMY_ITEMS, WEAPON_TIERS } from "@/lib/catalog";
import { formatCompact } from "@/lib/util/format";

const ITEM_NAME: Record<string, string> = Object.fromEntries(ECONOMY_ITEMS.map((i) => [i.code, i.name]));
const WEAPON_NAME: Record<string, string> = Object.fromEntries(WEAPON_TIERS.map((w) => [w.code, w.name]));
const ECON = new Set(ECONOMY_ITEMS.map((i) => i.code));

/** Readable label for a traded item (resource, weapon, or armor piece). */
function itemLabel(code: string): string {
  if (ITEM_NAME[code]) return ITEM_NAME[code];
  if (WEAPON_NAME[code]) return WEAPON_NAME[code];
  const m = code.match(/^([a-z]+)(\d)$/i); // armor: helmet4 → Helmet T4
  if (m) return `${m[1].charAt(0).toUpperCase()}${m[1].slice(1)} T${m[2]}`;
  return code;
}

function fmtTime(iso: string): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function money(n: number): string {
  return n >= 10000 ? formatCompact(n) : n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function Row({ t }: { t: MarketTx }) {
  const isResource = ECON.has(t.code);
  return (
    <div className="border-b border-line px-3.5 py-[7px]">
      <div className="grid grid-cols-[42px_1fr_auto] items-center gap-2">
        <span className="font-mono text-[11px] text-faint">{fmtTime(t.createdAt)}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          {isResource ? (
            <ItemIcon code={t.code} className="h-4 w-4 rounded-[2px]" />
          ) : (
            <EquipmentIcon code={t.code} className="h-4 w-4" />
          )}
          <span className="truncate text-[12px] font-semibold text-txt">{itemLabel(t.code)}</span>
          <span className="shrink-0 font-mono text-[11px] text-dim">×{t.quantity}</span>
        </span>
        <span className="font-mono text-[12px] font-bold tabular-nums">
          {money(t.money)} <span className="text-[10px] text-faint">cr</span>
        </span>
      </div>
      {t.seller || t.buyer ? (
        <div className="mt-0.5 truncate pl-[50px] text-[10px] text-faint">
          <span className="text-dim">{t.seller ?? "?"}</span> → {t.buyer ?? "?"}
        </div>
      ) : null}
    </div>
  );
}

export function Transactions({ className = "" }: { className?: string }) {
  const { data, isLoading, isError } = useTransactions();
  const items = data ?? [];
  const isMobile = useIsMobile();
  const [limit, setLimit] = useState(7);
  const shown = isMobile ? items.slice(0, limit) : items;

  return (
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <PanelHead title="Market Trades" meta="LATEST FILLS" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-down">Failed to load trades</div>
        ) : isLoading && items.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">Loading trades…</div>
        ) : items.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">No recent trades</div>
        ) : (
          <>
            {shown.map((t) => <Row key={t.id} t={t} />)}
            {isMobile && items.length > shown.length ? (
              <LoadMore onClick={() => setLimit((l) => l + 10)} remaining={items.length - shown.length} />
            ) : null}
          </>
        )}
      </div>
    </Panel>
  );
}
