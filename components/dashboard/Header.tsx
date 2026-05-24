"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWageStats } from "@/lib/api/queries";
import { formatPrice } from "@/lib/util/format";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`rounded-[4px] border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-line bg-panel text-dim hover:border-dim hover:bg-panel2 hover:text-txt"
      }`}
    >
      {label}
    </a>
  );
}

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
  const pathname = usePathname();

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
        <nav className="flex gap-2 border-l border-line pl-3">
          <NavLink href="/" label="Markets" active={pathname === "/"} />
          <NavLink href="/citizen" label="Citizen" active={pathname.startsWith("/citizen")} />
        </nav>
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
    </header>
  );
}
