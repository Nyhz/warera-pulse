import type { ReactNode } from "react";
import { Header } from "./Header";
import { LiveStatus } from "./LiveStatus";

/**
 * Shared page chrome: the header (logo, tool nav, wage, clock) and footer,
 * wrapping every tool page so they share width, tokens and a single logo load.
 *
 * `fill` locks the column to 100dvh with no page scroll (the Markets terminal);
 * omit it for normal scrolling pages (the Citizen dashboard).
 */
export function AppShell({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <div
      className={`mx-auto flex w-full max-w-[1920px] flex-col ${
        fill ? "lg:h-dvh lg:overflow-hidden" : "min-h-dvh"
      }`}
    >
      <Header />
      {children}
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-4 py-2.5 text-[10.5px] tracking-[0.04em] text-faint">
        <LiveStatus />
        <span>Powered by the WarEra Gateway · supported by warerastats.io</span>
        <span className="w-[44px]" aria-hidden />
      </footer>
    </div>
  );
}
