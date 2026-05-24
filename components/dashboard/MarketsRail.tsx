"use client";

import { useState } from "react";
import type { Item } from "@/lib/types";
import { useEconomyItems, useEquipmentAvgs } from "@/lib/api/queries";
import { useUIStore } from "@/lib/store/ui";
import { ARMOR_SLOTS, ARMOR_TIERS, WEAPON_TIERS, armorCode } from "@/lib/catalog";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { formatPrice } from "@/lib/util/format";

function Spark({ item }: { item: Item }) {
  const vals = item.spark ?? [];
  if (vals.length < 2) return <span className="h-[22px] w-[54px]" aria-hidden />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 54;
  const h = 22;
  const poly = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - 2 - ((v - min) / span) * (h - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = item.change24h >= 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[22px] w-[54px]" aria-hidden>
      <polyline
        points={poly}
        fill="none"
        stroke={up ? "var(--color-up)" : "var(--color-down)"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EconRow({ item }: { item: Item }) {
  const selected = useUIStore((s) => s.selectedSymbol);
  const setSelected = useUIStore((s) => s.setSelectedSymbol);
  const active = selected === item.symbol;

  return (
    <button
      type="button"
      onClick={() => setSelected(item.symbol)}
      aria-pressed={active}
      className={`grid w-full grid-cols-[1fr_auto_54px] items-center gap-2.5 border-b border-line px-3 py-1.5 text-left transition-colors hover:bg-[#0e1420] ${
        active ? "bg-[#0f1826] shadow-[inset_2px_0_0_var(--color-accent)]" : ""
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold uppercase tracking-[0.04em]">
          {item.symbol}
        </div>
        <div className="truncate text-[9.5px] font-medium text-faint">{item.name}</div>
      </div>
      <div className="font-mono text-[13px] font-bold tabular-nums">
        {formatPrice(item.price)}
      </div>
      <Spark item={item} />
    </button>
  );
}

function MilRow({
  label,
  tier,
  price,
  loading,
}: {
  label: string;
  tier: number;
  price?: number;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-line px-3 py-[7px]">
      <span className="rounded-[2px] bg-[#10161f] text-center font-mono text-[10px] font-bold text-dim">
        T{tier}
      </span>
      <span className="truncate text-[11px] font-semibold">{label}</span>
      <span className="font-mono text-[12px] font-bold tabular-nums">
        {price != null ? formatPrice(price, 2) : loading ? "…" : "—"}
      </span>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-line bg-panel2 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-dim">
      {children}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 border-b-2 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors ${
        active
          ? "border-accent text-txt"
          : "border-transparent text-dim hover:text-txt"
      }`}
    >
      {children}
    </button>
  );
}

export function MarketsRail({ className = "" }: { className?: string }) {
  const [tab, setTab] = useState<"economy" | "military">("economy");
  const { items } = useEconomyItems();
  const mil = tab === "military";
  const { data: avgs, isLoading: avgsLoading } = useEquipmentAvgs(mil);

  return (
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <PanelHead title="Markets" />
      <div className="flex shrink-0 border-b border-line">
        <Tab active={!mil} onClick={() => setTab("economy")}>
          Economy
        </Tab>
        <Tab active={mil} onClick={() => setTab("military")}>
          Military
        </Tab>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!mil ? (
          items.map((item) => <EconRow key={item.symbol} item={item} />)
        ) : (
          <>
            <GroupLabel>Weapon</GroupLabel>
            {WEAPON_TIERS.map((w) => (
              <MilRow
                key={w.code}
                label={w.name}
                tier={w.tier}
                price={avgs?.[w.code]}
                loading={avgsLoading}
              />
            ))}
            {ARMOR_SLOTS.map((slot) => (
              <div key={slot.slot}>
                <GroupLabel>{slot.name}</GroupLabel>
                {ARMOR_TIERS.map((t) => (
                  <MilRow
                    key={armorCode(slot.slot, t)}
                    label={`${slot.name} T${t}`}
                    tier={t}
                    price={avgs?.[armorCode(slot.slot, t)]}
                    loading={avgsLoading}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </Panel>
  );
}
