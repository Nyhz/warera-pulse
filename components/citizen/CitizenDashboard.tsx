"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  useCitizen,
  type CitizenCompany,
  type CitizenSkills,
  type CitizenWealth,
} from "@/lib/api/citizen";
import { useItemPrices, useWageStats } from "@/lib/api/snapshot";
import { useCountries, useRegions, type RegionInfo } from "@/lib/api/reference";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { Flag } from "@/components/ui/Flag";
import { formatPct, money, trimDecimal } from "@/lib/util/format";
import { SPECIALIZATION_BONUS, itemName } from "@/lib/catalog";

const STORAGE_KEY = "wr-citizen-id";

/** Pull a 24-hex user id out of a raw id or an app.warera.io profile URL. */
function parseUserId(raw: string): string | null {
  const m = raw.trim().match(/[0-9a-fA-F]{24}/);
  return m ? m[0].toLowerCase() : null;
}

const TIER_CLASS: Record<string, string> = {
  master: "text-accent border-accent/40 bg-accent/10",
  diamond: "text-cyan border-cyan/40 bg-cyan/10",
  platinum: "text-cyan border-cyan/40 bg-cyan/10",
  gold: "text-amber border-amber/40 bg-amber/10",
  silver: "text-dim border-line",
  bronze: "text-dim border-line",
};

export function CitizenDashboard() {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Restore the last-loaded id so it's already there next visit. Done after
  // mount to avoid a server/client hydration mismatch from reading localStorage.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserId(saved);
      setInput(saved);
    }
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseUserId(input);
    if (!id) {
      setError("Enter a 24-character user id or a profile URL.");
      return;
    }
    setError(null);
    setUserId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const { data, isLoading, isError, error: qErr } = useCitizen(userId);
  const { data: prices } = useItemPrices();
  const { data: countries } = useCountries();
  const { data: regions } = useRegions();
  const { data: wage } = useWageStats();
  const marketWage = wage?.average ?? 0;

  // Gross daily output value per company = production × live price.
  const grossByCompany = useMemo(() => {
    const map = new Map<string, number>();
    if (!data || !prices) return map;
    for (const c of data.companies) {
      map.set(c.id, c.production * (prices[c.itemCode] ?? 0));
    }
    return map;
  }, [data, prices]);

  // Net = gross minus the company's worker wages.
  const netByCompany = useMemo(() => {
    const map = new Map<string, number>();
    if (!data) return map;
    for (const c of data.companies) {
      map.set(c.id, (grossByCompany.get(c.id) ?? 0) - c.wageTotal);
    }
    return map;
  }, [data, grossByCompany]);

  const sortedCompanies = useMemo(() => {
    if (!data) return [];
    return [...data.companies].sort(
      (a, b) => (netByCompany.get(b.id) ?? 0) - (netByCompany.get(a.id) ?? 0),
    );
  }, [data, netByCompany]);

  // Active-company totals (disabled companies excluded).
  const totals = useMemo(() => {
    let gross = 0;
    let wages = 0;
    let value = 0;
    for (const c of sortedCompanies) {
      value += c.estimatedValue;
      if (c.disabled) continue;
      gross += grossByCompany.get(c.id) ?? 0;
      wages += c.wageTotal;
    }
    return { gross, wages, net: gross - wages, value };
  }, [sortedCompanies, grossByCompany]);

  const netWorth = data?.user.wealth.total ?? 0;
  const growth = netWorth > 0 ? totals.net / netWorth : 0;
  const activeCount = data ? data.companies.filter((c) => !c.disabled).length : 0;

  return (
    <div className="flex-1 px-4 py-4">
      {!userId ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="font-mono text-[12px] text-dim">
            Enter your WarEra user id to load your economic dashboard.
          </p>
          <IdForm value={input} onChange={setInput} onSubmit={submit} />
          {error ? <p className="text-[12px] text-down">{error}</p> : null}
        </div>
      ) : isLoading ? (
        <div className="py-20 text-center font-mono text-[12px] text-faint">Loading…</div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="font-mono text-[12px] text-down">
            {(qErr as Error)?.message ?? "Could not load this user."}
          </p>
          <IdForm value={input} onChange={setInput} onSubmit={submit} />
          {error ? <p className="text-[12px] text-down">{error}</p> : null}
        </div>
      ) : (
        <>
          {/* identity strip (carries the id input on the right) */}
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-1 pb-3.5">
            <Avatar url={data.user.avatarUrl} username={data.user.username} />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold">{data.user.username}</span>
                {data.user.countryId && countries?.get(data.user.countryId) ? (
                  <Flag code={countries.get(data.user.countryId)!.code} />
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip>LVL {data.user.level}</Chip>
                {data.user.isPremium ? (
                  <Chip className="text-amber border-amber/40 bg-amber/10">
                    Premium · {data.user.premiumMonths}mo
                  </Chip>
                ) : null}
                <Chip>Mil. Rank {data.user.militaryRank}</Chip>
                {data.user.damageRank.tier ? (
                  <Chip className={TIER_CLASS[data.user.damageRank.tier] ?? "text-dim border-line"}>
                    Damage #{data.user.damageRank.rank} · {data.user.damageRank.tier}
                  </Chip>
                ) : null}
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-5">
              <IdStat
                k="Net worth rank"
                v={`#${data.user.wealthRank.rank}`}
                vClass={TIER_CLASS[data.user.wealthRank.tier ?? ""]?.split(" ")[0] ?? "text-cyan"}
              />
              <IdStat k="Works" v={data.user.worksCount.toLocaleString()} />
              <IdForm value={input} onChange={setInput} onSubmit={submit} compact />
            </div>
          </div>

          {/* net worth + snapshot */}
          <div className="mt-px grid gap-px bg-line md:grid-cols-[1.15fr_0.85fr]">
            <NetWorth
              wealth={data.user.wealth}
              tier={data.user.wealthRank.tier}
              estimated={data.user.estimatedWealth}
            />
            <Panel className="flex flex-col">
              <PanelHead title="Snapshot" />
              <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
                <Tile k="Money on hand" v={money(data.user.wealth.money)} sub="liquid currency" />
                <Tile
                  k="Net income / day"
                  v={`+${money(totals.net)}`}
                  vClass="text-up"
                  sub={totals.wages > 0 ? `gross ${money(totals.gross)} − wages ${money(totals.wages)}` : "after worker wages"}
                />
                <Tile
                  k="Net income / month"
                  v={`+${money(totals.net * 30, 0)}`}
                  vClass="text-up"
                  sub="≈ 30 days"
                />
                <Tile
                  k="Daily growth"
                  v={formatPct(growth)}
                  vClass="text-up"
                  sub="net income vs net worth"
                />
                <Tile
                  k="Companies"
                  v={String(data.companies.length)}
                  sub={`${activeCount} active · ${data.companies.length - activeCount} disabled`}
                />
                <Tile
                  k="Companies value"
                  v={money(data.user.wealth.companies, 0)}
                  sub={
                    netWorth > 0
                      ? `${Math.round((data.user.wealth.companies / netWorth) * 100)}% of net worth`
                      : ""
                  }
                />
              </div>
            </Panel>
          </div>

          {/* economy skills */}
          <SkillsPanel skills={data.user.skills} companiesOwned={data.companies.length} />

          {/* companies */}
          <Panel className="mt-px">
            <PanelHead title="Companies" meta="PRODUCTION · LEVELS · DAILY OUTPUT" />
            {data.companies.length === 0 ? (
              <p className="px-3.5 py-6 text-center font-mono text-[12px] text-faint">
                No companies owned.
              </p>
            ) : (
              <>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[9.5px] uppercase tracking-[0.1em] text-faint">
                      <Th>Name</Th>
                      <Th>Produces</Th>
                      <Th r>Prod / day</Th>
                      <Th r>Net / day</Th>
                      <Th r>Payback</Th>
                      <Th r>Levels (E/S)</Th>
                      <Th r>Est. value</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCompanies.map((c) => {
                      const region = c.regionId ? regions?.get(c.regionId) : undefined;
                      const country = region?.countryId ? countries?.get(region.countryId) : undefined;
                      const base = country?.productionBonus ?? 0;
                      const spec = country?.specializedItem === c.itemCode ? SPECIALIZATION_BONUS : 0;
                      return (
                        <CompanyRow
                          key={c.id}
                          c={c}
                          net={netByCompany.get(c.id) ?? 0}
                          marketWage={marketWage}
                          region={region}
                          bonus={{ total: base + spec, base, spec }}
                        />
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-panel2 text-[12px]">
                      <td className="border-t border-line px-3.5 py-2.5" colSpan={3}>
                        Total · {activeCount} active{" "}
                        {activeCount === 1 ? "company" : "companies"}
                        {totals.wages > 0 ? (
                          <span className="text-faint">
                            {" "}
                            · gross {money(totals.gross)} − wages {money(totals.wages)}
                          </span>
                        ) : null}
                      </td>
                      <td className="border-t border-line px-3.5 py-2.5 text-right font-mono text-[14px] font-bold text-up">
                        +{money(totals.net)} / day
                      </td>
                      <td className="border-t border-line px-3.5 py-2.5 text-right font-mono text-dim">
                        {totals.net > 0 ? `${Math.round(totals.value / totals.net)}d` : "—"}
                      </td>
                      <td className="border-t border-line" />
                      <td className="border-t border-line px-3.5 py-2.5 text-right font-mono">
                        {money(totals.value, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="px-3.5 pb-3 pt-2.5 text-[10px] text-faint">
                  Net/day = production × live price − worker wages. Payback = est. value ÷ net/day.
                  Disabled companies are excluded from totals. Prices update with the live snapshot.
                </p>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function IdForm({
  value,
  onChange,
  onSubmit,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  compact?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-1.5">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="user id or profile URL…"
        aria-label="WarEra user id"
        className={`rounded-[3px] border border-line bg-panel px-2.5 py-1.5 font-mono text-[11px] text-txt outline-none focus:border-dim ${compact ? "w-[180px]" : "w-[280px]"}`}
      />
      <button
        type="submit"
        className="rounded-[3px] bg-accent px-3 py-1.5 text-[11px] font-bold tracking-[0.06em] text-[#04130a]"
      >
        Load
      </button>
    </form>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-[2px] border px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-[0.08em] ${className || "border-line text-dim"}`}
    >
      {children}
    </span>
  );
}

function IdStat({ k, v, vClass = "" }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="text-right">
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">{k}</div>
      <div className={`font-mono text-[15px] font-bold ${vClass}`}>{v}</div>
    </div>
  );
}

function Tile({ k, v, sub, vClass = "" }: { k: string; v: string; sub?: string; vClass?: string }) {
  return (
    <div className="bg-panel px-3.5 py-3">
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">{k}</div>
      <div className={`mt-1 font-mono text-[17px] font-bold tabular-nums ${vClass}`}>{v}</div>
      {sub ? <div className="mt-0.5 text-[10px] text-dim">{sub}</div> : null}
    </div>
  );
}

function Th({ children, r = false }: { children: React.ReactNode; r?: boolean }) {
  return (
    <th
      className={`border-b border-line px-3.5 py-2 font-semibold ${r ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

const NW_SEGMENTS: { key: keyof CitizenWealth; label: string; color: string }[] = [
  { key: "companies", label: "Companies", color: "var(--color-accent)" },
  { key: "equipments", label: "Equipments", color: "var(--color-cyan)" },
  { key: "items", label: "Items", color: "var(--color-amber)" },
  { key: "weapons", label: "Weapons", color: "#7d5fd0" },
  { key: "money", label: "Money", color: "var(--color-down)" },
];

function NetWorth({
  wealth,
  tier,
  estimated,
}: {
  wealth: CitizenWealth;
  tier: string | null;
  estimated: number;
}) {
  const total = wealth.total || 1;
  return (
    <Panel className="flex flex-col">
      <PanelHead title="Net Worth" meta={tier ? `${tier.toUpperCase()} TIER` : undefined} />
      <div className="p-3.5">
        <div className="font-mono text-[30px] font-extrabold tracking-tight">
          <span className="text-amber">$</span>
          {money(wealth.total)}
        </div>
        <div className="mt-0.5 text-[11px] text-dim">
          Total assets · in-game currency
          {estimated > 0 ? (
            <span className="text-faint"> · game est. ${money(estimated, 0)}</span>
          ) : null}
        </div>
        <div className="my-4 flex h-2.5 overflow-hidden rounded-[2px] border border-line">
          {NW_SEGMENTS.map((s) => {
            const pct = (wealth[s.key] / total) * 100;
            return pct > 0 ? (
              <span key={s.key} style={{ width: `${pct}%`, background: s.color }} />
            ) : null;
          })}
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2">
          {NW_SEGMENTS.map((s) => (
            <div key={s.key} className="flex items-center gap-2 text-[12px]">
              <span
                className="h-2 w-2 flex-none rounded-[2px]"
                style={{ background: s.color }}
              />
              <span className="text-dim">{s.label}</span>
              <span className="ml-auto font-mono font-bold tabular-nums">
                {money(wealth[s.key], 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Lucide "factory" glyph — inherits text color via currentColor. */
function FactoryIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M17 18h1M12 18h1M7 18h1" />
    </svg>
  );
}

/** Production-bonus chip with a hover tooltip breaking down its sources. */
function BonusTag({
  total,
  base,
  spec,
  itemCode,
}: {
  total: number;
  base: number;
  spec: number;
  itemCode: string;
}) {
  return (
    <span className="group relative inline-flex cursor-default items-center gap-1 font-semibold text-up">
      <FactoryIcon className="h-3 w-3" />
      +{trimDecimal(total)}%
      <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 hidden w-max max-w-[280px] rounded-[3px] border border-line bg-panel2 p-2.5 text-left shadow-lg group-hover:block">
        <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.12em] text-faint">
          Production bonus
        </span>
        <span className="block text-[11px] leading-relaxed text-up">
          +{trimDecimal(base)}% strategic resources production
        </span>
        {spec > 0 ? (
          <span className="block text-[11px] leading-relaxed text-up">
            +{spec}% {itemName(itemCode)} specialization
          </span>
        ) : null}
      </span>
    </span>
  );
}

function CompanyRow({
  c,
  net,
  marketWage,
  region,
  bonus,
}: {
  c: CitizenCompany;
  net: number;
  marketWage: number;
  region?: RegionInfo;
  bonus: { total: number; base: number; spec: number };
}) {
  const perWorker = c.workerCount > 0 ? c.wageTotal / c.workerCount : 0;
  // Paying below the market wage is good for the owner.
  const wageGood = marketWage > 0 && perWorker > 0 && perWorker <= marketWage;
  const payback = !c.disabled && net > 0 ? `${Math.round(c.estimatedValue / net)}d` : "—";
  return (
    <tr className={`text-[12px] ${c.disabled ? "opacity-40" : ""}`}>
      <td className="border-b border-line px-3.5 py-2.5">
        <div className="flex items-center font-semibold">
          {c.name}
          {c.disabled ? (
            <span className="ml-2 rounded-[2px] border border-down/35 px-[5px] py-px text-[9px] uppercase tracking-[0.06em] text-down">
              off
            </span>
          ) : null}
          {c.workerCount > 0 ? (
            <span
              title={`Worker wages vs market avg ${money(marketWage)}`}
              className={`ml-2 rounded-[2px] border px-[5px] py-px font-mono text-[9px] tracking-[0.04em] ${
                wageGood ? "border-up/35 text-up" : "border-amber/35 text-amber"
              }`}
            >
              {c.workerCount}w · {money(c.wageTotal)}/d
            </span>
          ) : null}
        </div>
        {region ? (
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-normal text-faint">
            {region.countryCode ? <Flag code={region.countryCode} /> : null}
            <span>{region.name}</span>
            {bonus.total > 0 ? (
              <BonusTag
                total={bonus.total}
                base={bonus.base}
                spec={bonus.spec}
                itemCode={c.itemCode}
              />
            ) : null}
          </div>
        ) : null}
      </td>
      <td className="border-b border-line px-3.5 py-2.5">
        <span className="rounded-[2px] border border-cyan/30 bg-cyan/[0.07] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.06em] text-cyan">
          {itemName(c.itemCode)}
        </span>
      </td>
      <td className="border-b border-line px-3.5 py-2.5 text-right font-mono tabular-nums">
        {c.production.toFixed(2)}
      </td>
      <td
        className={`border-b border-line px-3.5 py-2.5 text-right font-mono font-bold tabular-nums ${
          c.disabled ? "" : net < 0 ? "text-down" : "text-up"
        }`}
      >
        {money(net)}
      </td>
      <td className="border-b border-line px-3.5 py-2.5 text-right font-mono tabular-nums text-dim">
        {payback}
      </td>
      <td className="border-b border-line px-3.5 py-2.5 text-right font-mono text-[11px] text-dim">
        E<b className="text-txt">{c.levels.automatedEngine}</b> S
        <b className="text-txt">{c.levels.storage}</b>
      </td>
      <td className="border-b border-line px-3.5 py-2.5 text-right font-mono tabular-nums">
        {money(c.estimatedValue, 0)}
      </td>
    </tr>
  );
}

function Avatar({ url, username }: { url: string | null; username: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <Image
        src={url}
        alt={username}
        width={46}
        height={46}
        onError={() => setFailed(true)}
        className="h-[46px] w-[46px] rounded-[4px] border border-line object-cover"
      />
    );
  }
  return (
    <div className="grid h-[46px] w-[46px] place-items-center rounded-[4px] border border-line bg-gradient-to-br from-[#11304a] to-panel text-[18px] font-extrabold text-cyan">
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

const SKILL_LABELS: { key: keyof CitizenSkills; label: string }[] = [
  { key: "companies", label: "Companies limit" },
  { key: "production", label: "Production" },
  { key: "entrepreneurship", label: "Entrepreneurship" },
  { key: "energy", label: "Energy" },
  { key: "management", label: "Management" },
];

function SkillsPanel({ skills, companiesOwned }: { skills: CitizenSkills; companiesOwned: number }) {
  // Company slots = 2 base + 1 per `companies` skill level.
  const companyLimit = 2 + skills.companies;
  const atCapacity = companiesOwned >= companyLimit;
  return (
    <Panel className="mt-px">
      <PanelHead title="Economy Skills" meta="LEVELS" />
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
        {SKILL_LABELS.map((s) => (
          <div key={s.key} className="bg-panel px-3.5 py-3">
            <div className="text-[9.5px] uppercase tracking-[0.1em] text-faint">{s.label}</div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-mono text-[17px] font-bold tabular-nums">Lv {skills[s.key]}</span>
              {s.key === "companies" ? (
                <span
                  className={`font-mono text-[12px] font-bold tabular-nums ${atCapacity ? "text-amber" : "text-dim"}`}
                >
                  {companiesOwned}/{companyLimit}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
