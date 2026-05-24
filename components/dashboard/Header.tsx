"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useWageStats } from "@/lib/api/queries";
import { formatPrice } from "@/lib/util/format";

const NAV = [
  { href: "/", label: "Markets" },
  { href: "/economy", label: "Economy" },
  { href: "/citizen", label: "Citizen" },
];

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
    // Client-only clock: starts after mount to avoid a server/client hydration
    // mismatch on the rendered time.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="relative flex items-center gap-3.5 border-b border-line bg-panel px-4 py-[11px]">
      <Image
        src="/logo.webp"
        alt="WarEra Pulse"
        width={408}
        height={160}
        priority
        className="h-[34px] w-auto"
      />
      <nav className="hidden gap-2 border-l border-line pl-3 md:flex">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} active={isActive(n.href)} />
        ))}
      </nav>

      <div className="flex-1" />

      {wage ? (
        <div className="hidden items-center gap-3 border-r border-line pr-3.5 font-mono text-[12.5px] lg:flex">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-dim">Wage</span>
          <span className="tabular-nums">
            <span className="text-faint">min</span> <b className="text-up">{formatPrice(wage.min)}</b>
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

      <div className="hidden font-mono text-[12px] text-dim sm:block">
        <b className="text-txt">{time}</b> UTC
      </div>

      {/* Mobile hamburger (<768) */}
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={menuOpen}
        className="rounded-[4px] border border-line p-1.5 text-dim transition-colors hover:text-txt md:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
          {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />
      ) : null}
      <nav
        className={`absolute left-0 right-0 top-full z-50 flex-col gap-1 border-b border-line bg-panel p-2 md:hidden ${
          menuOpen ? "flex" : "hidden"
        }`}
      >
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className={`rounded-[4px] px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              isActive(n.href)
                ? "bg-accent/10 text-accent"
                : "text-dim hover:bg-panel2 hover:text-txt"
            }`}
          >
            {n.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
