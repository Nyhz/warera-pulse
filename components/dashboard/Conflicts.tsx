"use client";

import { useEffect, useState } from "react";
import { useLiveBattles, type LiveBattle, type LiveBattleSide } from "@/lib/api/queries";
import { Panel, PanelHead, HotBadge } from "@/components/ui/Panel";
import { formatCompact, formatCountdown } from "@/lib/util/format";
import { Flag } from "@/components/ui/Flag";

const MIN_DAMAGE = 10_000_000;

function Countdown({ iso }: { iso?: string }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!iso) {
      setLeft(null);
      return;
    }
    const target = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, Math.round((target - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (left == null) return null;
  return <>{formatCountdown(left)}</>;
}

function SideLabel({
  side,
  role,
  align,
}: {
  side: LiveBattleSide;
  role: "ATK" | "DEF";
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Flag code={side.code} />
      <span className="truncate text-[12px] font-bold text-txt">{side.name}</span>
      <span
        className={`shrink-0 rounded-[2px] px-1 py-px text-[8px] font-bold uppercase tracking-[0.08em] ${
          role === "DEF" ? "bg-amber/15 text-amber" : "bg-cyan/15 text-cyan"
        }`}
      >
        {role}
      </span>
    </div>
  );
}

function ConflictCard({ battle }: { battle: LiveBattle }) {
  const a = battle.attacker;
  const d = battle.defender;
  const aLeads = a.ground > d.ground;
  const dLeads = d.ground > a.ground;
  // A side past ~250 ground is about to take the round — flag it as ending soon.
  const nearEnd = Math.max(a.ground, d.ground) > 250;

  return (
    <div className={`border-b border-line px-3.5 py-3 ${nearEnd ? "battle-near-end" : ""}`}>
      {/* region + the prominent best-of-2 result */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-bold text-txt">
          <span className="text-faint">📍 </span>
          {battle.region || `${a.name} v ${d.name}`}
        </span>
        <span className="shrink-0 font-mono text-[22px] font-extrabold leading-none tabular-nums">
          <span className="text-cyan">{a.wonRounds}</span>
          <span className="text-faint">–</span>
          <span className="text-amber">{d.wonRounds}</span>
        </span>
      </div>

      {/* identity with full names: attacker left, defender right */}
      <div className="flex items-center justify-between gap-2">
        <SideLabel side={a} role="ATK" align="left" />
        <SideLabel side={d} role="DEF" align="right" />
      </div>

      {/* ground — per round, with tick gain + countdown between */}
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`font-mono text-[15px] font-extrabold tabular-nums ${
            aLeads ? "text-cyan" : "text-faint"
          }`}
        >
          ⛰ {a.ground}
        </span>
        <span className="text-center font-mono text-[10px] leading-tight text-dim">
          <span className="text-up">+{battle.tickPoints}⛰</span> /tick
          {battle.nextTickAt ? (
            <>
              <br />
              <span className="text-txt">
                ⏱ <Countdown iso={battle.nextTickAt} />
              </span>
            </>
          ) : null}
        </span>
        <span
          className={`font-mono text-[15px] font-extrabold tabular-nums ${
            dLeads ? "text-amber" : "text-faint"
          }`}
        >
          {d.ground} ⛰
        </span>
      </div>

      {/* cumulative damage (all rounds) + share above the bar */}
      <div className="mt-2 flex items-end justify-between font-mono text-[10px]">
        <span className="flex items-baseline gap-1.5">
          <b className="text-[12px]">{a.share}%</b>
          <span className="text-down">🔥 {formatCompact(a.damage)}</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-down">{formatCompact(d.damage)} 🔥</span>
          <b className="text-[12px]">{d.share}%</b>
        </span>
      </div>

      {/* single split bar — cyan = attacker, amber = defender */}
      <div className="mt-1 flex h-2 w-full overflow-hidden rounded-[2px] bg-[#10161f]">
        <div
          className="h-full bg-cyan transition-[width] duration-500"
          style={{ width: `${a.share}%` }}
        />
        <div className="h-full flex-1 bg-amber transition-[width] duration-500" />
      </div>

      {/* deep-link into the live battle on app.warera.io */}
      <a
        href={`https://app.warera.io/battle/${battle.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex items-center justify-center gap-1.5 rounded-[3px] border border-down/40 bg-down/10 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-down transition-colors hover:bg-down/20"
      >
        ⚔ Fight <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

export function Conflicts({ className = "" }: { className?: string }) {
  const { battles, isLoading, isError } = useLiveBattles();
  const hot = battles
    .filter((b) => b.attacker.damage + b.defender.damage >= MIN_DAMAGE)
    .sort(
      (x, y) =>
        y.attacker.damage + y.defender.damage - (x.attacker.damage + x.defender.damage),
    );

  return (
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <PanelHead
        title="Hot Conflicts"
        badge={hot.length ? <HotBadge>{hot.length} Hot</HotBadge> : undefined}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-down">
            Failed to load battles
          </div>
        ) : isLoading && hot.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">
            Loading battles…
          </div>
        ) : hot.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">
            No conflicts over 10M damage
          </div>
        ) : (
          hot.map((b) => <ConflictCard key={b.id} battle={b} />)
        )}
      </div>
    </Panel>
  );
}
