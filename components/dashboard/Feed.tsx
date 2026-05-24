"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFeed } from "@/lib/api/queries";
import type { Country, WrEvent } from "@/lib/api/schemas";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { Flag } from "@/components/ui/Flag";
import { CountryPicker } from "@/components/ui/CountryPicker";
import { ItemIcon } from "@/components/ui/ItemIcon";
import { LoadMore } from "@/components/ui/LoadMore";
import { useIsMobile } from "@/lib/hooks";
import { ECONOMY_CODES } from "@/lib/catalog";
import { formatCompact } from "@/lib/util/format";

const ECON_SET = new Set(ECONOMY_CODES);
const FEED_COUNTRY_KEY = "wr-feed-country";

/** Country-id fields that can appear in an event's `data`, by event type. */
const COUNTRY_FIELDS = [
  "attackerCountry",
  "defenderCountry",
  "toCountry",
  "fromCountry",
  "country",
  "occupyingCountryId",
  "revoltingCountryId",
  "wonBy",
];

/** All country ids an event involves (top-level + type-specific data fields). */
function eventCountryIds(e: WrEvent): Set<string> {
  const ids = new Set<string>(e.countries ?? []);
  const d = e.data as Record<string, unknown>;
  for (const f of COUNTRY_FIELDS) {
    const v = d[f];
    if (typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v)) ids.add(v);
  }
  if (Array.isArray(d.countries)) {
    for (const v of d.countries) if (typeof v === "string") ids.add(v);
  }
  return ids;
}

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

  const [country, setCountry] = useState("");
  useEffect(() => {
    // Restore the persisted filter after mount; reading localStorage during
    // render would cause a server/client hydration mismatch.
    const saved = localStorage.getItem(FEED_COUNTRY_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setCountry(saved);
  }, []);
  const pickCountry = (id: string) => {
    setCountry(id);
    if (id) localStorage.setItem(FEED_COUNTRY_KEY, id);
    else localStorage.removeItem(FEED_COUNTRY_KEY);
  };
  const countryOptions = useMemo(
    () =>
      countriesById ? [...countriesById.values()].sort((a, b) => a.name.localeCompare(b.name)) : [],
    [countriesById],
  );
  const shown = useMemo(
    () => (country ? events.filter((e) => eventCountryIds(e).has(country)) : events),
    [events, country],
  );
  const countryName = country ? countriesById?.get(country)?.name : null;

  const isMobile = useIsMobile();
  const [limit, setLimit] = useState(7);
  const visible = isMobile ? shown.slice(0, limit) : shown.slice(0, 20);

  const tag = (id?: string): ReactNode => {
    const c: Country | undefined = id ? countriesById?.get(id) : undefined;
    const code = c?.code?.toUpperCase() ?? "??";
    const name = c?.name ?? code;
    return (
      <span className="inline-flex items-center gap-1 align-middle">
        <Flag code={code} className="!h-2.5 !w-[14px]" />
        <b className="font-semibold">{name}</b>
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
      case "regionTransfer": {
        const regs = (d.regions as string[]) ?? [];
        const cs = (d.countries as string[]) ?? [];
        const more = regs.length > 1 ? ` (+${regs.length - 1})` : "";
        return {
          icon: <span className="text-amber">🚩</span>,
          msg: <><b>{region(regs[0])}</b>{more} transferred · {tag(cs[1])} from {tag(cs[0])}</>,
        };
      }
      case "countryMoneyTransfer": {
        const cs = (d.countries as string[]) ?? [];
        return {
          icon: <span className="text-amber">💰</span>,
          msg: <>{tag(cs[0])} sent <b className="font-mono">{formatCompact(Number(d.money) || 0)}</b> to {tag(cs[1])}</>,
        };
      }
      case "financedRevolt":
        return {
          icon: <span className="text-down">✊</span>,
          msg: <>Revolt financed in <b>{region(s("regionId"))}</b> · {tag(s("revoltingCountryId"))} vs {tag(s("occupyingCountryId"))}</>,
        };
      case "bankruptcy":
        return {
          icon: <span className="text-down">💸</span>,
          msg: <>{tag(s("country"))} went bankrupt</>,
        };
      case "depositDiscovered": {
        const code = s("itemCode") ?? "";
        return {
          icon: ECON_SET.has(code) ? (
            <ItemIcon code={code} className="h-4 w-4 rounded-[2px]" />
          ) : (
            <span className="text-amber">⛏</span>
          ),
          msg: <><b className="font-mono">{code}</b> deposit +{String(d.bonusPercent ?? "")}% in <b>{region(s("region"))}</b></>,
        };
      }
      case "newPresident":
        return {
          icon: <span className="text-amber">🏛</span>,
          msg: <>New president elected in {tag(s("country") ?? c[0])}</>,
        };
      default:
        return {
          icon: <span>📌</span>,
          msg: <>{humanize(d.type)}{c.length ? <> · {tag(c[0])}{c[1] ? <> {tag(c[1])}</> : null}</> : null}</>,
        };
    }
  }

  return (
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <PanelHead
        title="Global Feed"
        badge={
          <CountryPicker countries={countryOptions} value={country} onChange={pickCountry} />
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isError ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-down">
            Failed to load events
          </div>
        ) : isLoading && events.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">
            Loading events…
          </div>
        ) : shown.length === 0 ? (
          <div className="px-3.5 py-10 text-center font-mono text-[11px] text-faint">
            No recent events{countryName ? ` for ${countryName}` : ""}
          </div>
        ) : (
          <>
            {visible.map((e) => {
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
            })}
            {isMobile && shown.length > visible.length ? (
              <LoadMore onClick={() => setLimit((l) => l + 10)} remaining={shown.length - visible.length} />
            ) : null}
          </>
        )}
      </div>
    </Panel>
  );
}
