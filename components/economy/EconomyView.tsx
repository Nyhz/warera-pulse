"use client";

import { useMemo, useState } from "react";
import { useItemPrices, useCountries } from "@/lib/api/queries";
import type { Country } from "@/lib/api/schemas";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { ItemIcon } from "@/components/ui/ItemIcon";
import { Flag } from "@/components/ui/Flag";
import { ECONOMY_ITEMS, RECIPES, RAW_POINTS } from "@/lib/catalog";
import { formatPrice, formatPct } from "@/lib/util/format";

const ITEM_NAME: Record<string, string> = Object.fromEntries(
  ECONOMY_ITEMS.map((i) => [i.code, i.name]),
);
const itemName = (code: string) => ITEM_NAME[code] ?? code.charAt(0).toUpperCase() + code.slice(1);

/** Normalize a value within [min,max] to a 18–100% bar width so ranking shows. */
const barWidth = (v: number, min: number, max: number) =>
  18 + ((v - min) / (max - min || 1)) * 82;

const pct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** One leaderboard row: a proportional bar behind icon · name/sub · big value. */
function BarRow({
  rank,
  icon,
  name,
  sub,
  value,
  label,
  width,
  accent,
}: {
  rank: number;
  icon: React.ReactNode;
  name: string;
  sub: React.ReactNode;
  value: string;
  label: string;
  width: number;
  accent: "up" | "cyan";
}) {
  const grad =
    accent === "up"
      ? "linear-gradient(90deg, rgba(63,185,80,0.20), rgba(63,185,80,0.04))"
      : "linear-gradient(90deg, rgba(57,192,211,0.18), rgba(57,192,211,0.03))";
  const edge = accent === "up" ? "rgba(63,185,80,0.4)" : "rgba(57,192,211,0.4)";
  return (
    <div className="relative mb-1.5 flex items-center gap-2.5 overflow-hidden rounded-[5px] border border-line bg-[#0e141f] px-3 py-2">
      <div
        className="absolute inset-y-0 left-0 z-0"
        style={{ width: `${width}%`, background: grad, borderRight: `1px solid ${edge}` }}
      />
      <span className="relative z-10 w-4 text-right font-mono text-[11px] text-faint">{rank}</span>
      <span className="relative z-10 flex-none">{icon}</span>
      <div className="relative z-10 min-w-0">
        <div className="truncate text-[12.5px] font-bold">{name}</div>
        <div className="truncate font-mono text-[10px] text-dim">{sub}</div>
      </div>
      <div className="relative z-10 ml-auto pl-2 text-right">
        <div className={`font-mono text-[16px] font-extrabold leading-none text-${accent}`}>
          {value}
        </div>
        <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-faint">{label}</div>
      </div>
    </div>
  );
}

type Mode = "buy" | "full";

function Refining({ prices, className = "" }: { prices: Record<string, number>; className?: string }) {
  const [mode, setMode] = useState<Mode>("buy");

  const rows = useMemo(() => {
    const out = RECIPES.map((r) => {
      const sell = prices[r.code] ?? 0;
      const marketCost = Object.entries(r.needs).reduce(
        (s, [code, qty]) => s + qty * (prices[code] ?? 0),
        0,
      );
      const inputPoints = Object.entries(r.needs).reduce(
        (s, [code, qty]) => s + qty * (RAW_POINTS[code] ?? 1),
        0,
      );
      const points = mode === "full" ? r.points + inputPoints : r.points;
      const cost = mode === "full" ? 0 : marketCost;
      const margin = sell - cost;
      const marginPct = cost > 0 ? margin / cost : null;
      const perPoint = points > 0 ? margin / points : 0;
      return { ...r, sell, margin, marginPct, perPoint, points };
    });
    return out.sort((a, b) => b.perPoint - a.perPoint);
  }, [prices, mode]);

  const min = Math.min(...rows.map((r) => r.perPoint));
  const max = Math.max(...rows.map((r) => r.perPoint));

  const ModeBtn = ({ m, label }: { m: Mode; label: string }) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-[3px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] transition-colors ${
        mode === m ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-dim hover:text-txt"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Panel className={`flex h-[460px] flex-col overflow-hidden lg:h-auto lg:min-h-0 ${className}`}>
      <PanelHead title="Refining Margins" meta="MARGIN / PT" />
      <div className="flex h-[44px] shrink-0 items-center gap-1.5 border-b border-line px-3">
        <ModeBtn m="buy" label="Buy" />
        <ModeBtn m="full" label="Full chain" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {rows.map((r, i) => (
          <BarRow
            key={r.code}
            rank={i + 1}
            icon={<ItemIcon code={r.code} className="h-6 w-6 rounded-[3px]" />}
            name={itemName(r.code)}
            sub={
              <>
                {Object.entries(r.needs)
                  .map(([code, qty]) => `${qty}× ${itemName(code)}`)
                  .join(", ")}{" "}
                · {r.points}pts{r.marginPct != null ? ` · +${pct(r.marginPct * 100)}%` : ""}
              </>
            }
            value={formatPrice(r.perPoint)}
            label="margin / pt"
            width={barWidth(r.perPoint, min, max)}
            accent="up"
          />
        ))}
        <p className="px-1 pt-1 text-[10px] text-faint">
          {mode === "buy"
            ? "Buy inputs at market · points = refine step. Margin/pt = (sell − inputs) ÷ points."
            : "Produce inputs too · points include mining them. Value/pt = sell ÷ total points."}
        </p>
      </div>
    </Panel>
  );
}

type Sort = "bonus" | "dev" | "tax";

function Nations({ countries, className = "" }: { countries: Country[]; className?: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("bonus");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term ? countries.filter((c) => c.name.toLowerCase().includes(term)) : countries;
    return [...filtered].sort((a, b) => {
      if (sort === "tax") return (a.incomeTax ?? 0) - (b.incomeTax ?? 0);
      if (sort === "dev") return (b.development ?? 0) - (a.development ?? 0);
      return (b.productionBonus ?? 0) - (a.productionBonus ?? 0);
    });
  }, [countries, q, sort]);

  const bonuses = countries.map((c) => c.productionBonus ?? 0);
  const min = bonuses.length ? Math.min(...bonuses) : 0;
  const max = bonuses.length ? Math.max(...bonuses) : 1;

  const SortBtn = ({ k, label }: { k: Sort; label: string }) => (
    <button
      type="button"
      onClick={() => setSort(k)}
      className={`rounded-[3px] border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${
        sort === k ? "border-accent/40 bg-accent/10 text-accent" : "border-line text-dim hover:text-txt"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Panel className={`flex h-[460px] flex-col overflow-hidden lg:h-auto lg:min-h-0 ${className}`}>
      <PanelHead title="Nations Economy" meta={`${rows.length} of ${countries.length}`} />
      <div className="flex h-[44px] shrink-0 items-center gap-2 border-b border-line px-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search country…"
          className="w-[150px] rounded-[3px] border border-line bg-panel2 px-2.5 py-1.5 text-[11px] text-txt outline-none focus:border-dim"
        />
        <div className="ml-auto flex gap-1.5">
          <SortBtn k="bonus" label="Bonus" />
          <SortBtn k="dev" label="Dev" />
          <SortBtn k="tax" label="Tax" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {rows.map((c, i) => (
          <BarRow
            key={c._id}
            rank={i + 1}
            icon={<Flag code={c.code.toUpperCase()} className="!h-4 !w-[22px]" />}
            name={c.name}
            sub={
              <>
                {c.specializedItem ? `${itemName(c.specializedItem)} · ` : ""}tax {c.incomeTax ?? 0}% ·
                dev {Math.round(c.development ?? 0)}
              </>
            }
            value={`+${pct(c.productionBonus ?? 0)}%`}
            label="prod bonus"
            width={barWidth(c.productionBonus ?? 0, min, max)}
            accent="cyan"
          />
        ))}
      </div>
    </Panel>
  );
}

export function EconomyView() {
  const { data: prices, isLoading } = useItemPrices();
  const { data: countries } = useCountries();
  const list = useMemo(() => (countries ? [...countries.values()] : []), [countries]);

  if (!prices && isLoading) {
    return <div className="flex-1 py-20 text-center font-mono text-[12px] text-faint">Loading…</div>;
  }

  return (
    <div className="flex flex-1 flex-col gap-px bg-line lg:grid lg:min-h-0 lg:grid-cols-[1.1fr_minmax(0,0.9fr)]">
      {prices ? <Refining prices={prices} className="min-w-0" /> : <div />}
      <Nations countries={list} className="min-w-0" />
    </div>
  );
}
