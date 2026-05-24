"use client";

import type { ReactNode } from "react";
import { useFeed } from "@/lib/api/queries";
import type { Country } from "@/lib/api/schemas";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { Flag } from "@/components/ui/Flag";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function humanize(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function Feed({ className = "" }: { className?: string }) {
  const { events, countriesById, regionsById, isLoading, isError } = useFeed();

  const tag = (id?: string): ReactNode => {
    const c: Country | undefined = id ? countriesById?.get(id) : undefined;
    const code = c?.code?.toUpperCase() ?? "??";
    return (
      <span className="inline-flex items-center gap-1 align-middle">
        <Flag code={code} className="!h-2.5 !w-[14px]" />
        <b className="font-mono text-[10.5px]">{code}</b>
      </span>
    );
  };
  const region = (id?: string) => (id && regionsById?.get(id)?.name) || "a region";

  function render(e: (typeof events)[number]): { icon: ReactNode; msg: ReactNode } {
    const d = e.data as Record<string, unknown> & { type: string };
    const c = e.countries;
    const s = (k: string) => d[k] as string | undefined;
    switch (d.type) {
      case "warDeclared":
        return {
          icon: <span className="text-down">⚔</span>,
          msg: <>{tag(s("attackerCountry"))} declared war on {tag(s("defenderCountry"))}</>,
        };
      case "battleOpened":
        return {
          icon: <span className="text-cyan">⚑</span>,
          msg: <>New battle · {tag(s("attackerCountry"))} × {tag(s("defenderCountry"))}</>,
        };
      case "battleEnded": {
        const won = s("wonBy");
        const wonTag = won === "attacker" ? tag(s("attackerCountry")) : won === "defender" ? tag(s("defenderCountry")) : countriesById?.get(won ?? "") ? tag(won) : null;
        return {
          icon: <span className="text-cyan">🏁</span>,
          msg: <>Battle for <b>{region(s("defenderRegion") ?? s("attackerRegion"))}</b> ended{wonTag ? <> · won by {wonTag}</> : null}</>,
        };
      }
      case "peaceMade":
      case "peace_agreement":
        return {
          icon: <span className="text-up">🕊</span>,
          msg: <>{tag(c[0])} & {tag(c[1])} made peace</>,
        };
      case "allianceFormed":
        return {
          icon: <span className="text-up">🤝</span>,
          msg: <>{tag(c[0])} & {tag(c[1])} formed an alliance</>,
        };
      case "allianceBroken":
        return {
          icon: <span className="text-amber">💔</span>,
          msg: <>{tag(c[0])} & {tag(c[1])} broke their alliance</>,
        };
      case "regionLiberated":
        return {
          icon: <span className="text-cyan">🚩</span>,
          msg: <><b>{region(s("region"))}</b> liberated · {tag(s("toCountry"))} from {tag(s("fromCountry"))}</>,
        };
      case "regionTransfer":
        return {
          icon: <span className="text-amber">🚩</span>,
          msg: <><b>{region(s("region"))}</b> transferred to {tag(s("toCountry"))}</>,
        };
      case "depositDiscovered":
        return {
          icon: <span className="text-amber">⛏</span>,
          msg: <><b className="font-mono">{s("itemCode")}</b> deposit +{String(d.bonusPercent ?? "")}% in <b>{region(s("region"))}</b></>,
        };
      case "newPresident":
        return {
          icon: <span className="text-amber">🏛</span>,
          msg: <>New president elected in {tag(c[0])}</>,
        };
      default:
        return {
          icon: <span className="text-faint">•</span>,
          msg: <>{humanize(d.type)}{c.length ? <> · {tag(c[0])}{c[1] ? <> {tag(c[1])}</> : null}</> : null}</>,
        };
    }
  }

  return (
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <PanelHead title="Global Feed" meta="LIVE EVENTS" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-down">
            Failed to load events
          </div>
        ) : isLoading && events.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">
            No recent events
          </div>
        ) : (
          events.slice(0, 20).map((e) => {
            const { icon, msg } = render(e);
            return (
              <div
                key={e._id}
                className="grid grid-cols-[46px_18px_1fr] items-start gap-2 border-b border-line px-3.5 py-[9px]"
              >
                <span className="font-mono text-[11px] text-faint">{fmtTime(e.createdAt)}</span>
                <span className="text-[12px] leading-[1.3]">{icon}</span>
                <span className="text-[12.5px] leading-[1.5]">{msg}</span>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
