"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useWageStats } from "@/lib/api/queries";
import { formatPrice } from "@/lib/util/format";
import { TokenButton } from "@/components/dashboard/TokenButton";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Header() {
  const now = useClock();
  const time = now
    ? now.toLocaleTimeString("en-GB", { hour12: false, timeZone: "UTC" })
    : "--:--:--";
  const { data: wage } = useWageStats();

  return (
    <header className="flex items-center gap-3.5 border-b border-line bg-panel px-4 py-[11px]">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.webp"
          alt="WarEra Pulse"
          width={408}
          height={160}
          priority
          className="h-[34px] w-auto"
        />
        <span className="border-l border-line pl-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-dim">
          Geo Terminal
        </span>
      </div>
      <div className="flex-1" />
      {wage ? (
        <div className="hidden items-center gap-3 border-r border-line pr-3.5 font-mono text-[12.5px] lg:flex">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-dim">
            Wage
          </span>
          <span className="tabular-nums">
            <span className="text-faint">min</span>{" "}
            <b className="text-up">{formatPrice(wage.min)}</b>
          </span>
          <span className="tabular-nums">
            <span className="text-faint">avg</span> <b>{formatPrice(wage.average)}</b>
          </span>
          <span className="tabular-nums">
            <span className="text-faint">max</span>{" "}
            <b className="text-amber">{formatPrice(wage.max)}</b>
          </span>
        </div>
      ) : null}
      <div className="font-mono text-[12px] text-dim">
        <b className="text-txt">{time}</b> UTC
      </div>
      <TokenButton />
    </header>
  );
}
