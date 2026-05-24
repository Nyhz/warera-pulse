import { AppShell } from "@/components/dashboard/AppShell";
import { Ticker } from "@/components/dashboard/Ticker";
import { MarketsRail, MarketsRailMobile } from "@/components/dashboard/MarketsRail";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { HotNations } from "@/components/dashboard/HotNations";
import { Conflicts } from "@/components/dashboard/Conflicts";
import { Feed } from "@/components/dashboard/Feed";
import { Transactions } from "@/components/dashboard/Transactions";

export default function Home() {
  return (
    <AppShell fill>
      <Ticker />

      {/* Mobile (<768px): stacked — chart, then markets rail (so you can switch
          resource right under the chart), then conflicts/nations, feed last.
          768–1024px: 2 columns [rail | chart+feed] + Hot Nations & Active
          Conflicts side by side as a full-width bottom row (page scrolls).
          ≥1024px: 3 columns locked to 100dvh (chart 5fr over feed 2fr). */}
      <main className="flex flex-1 flex-col gap-px bg-line md:grid md:grid-cols-[212px_minmax(0,1fr)] md:[grid-template-rows:520px_300px] lg:min-h-0 lg:grid-cols-[268px_minmax(0,1fr)_360px] lg:[grid-template-rows:minmax(0,5fr)_minmax(0,2fr)]">
        {/* Mobile (<md): markets as a dropdown above the chart so you can switch
            resource without scrolling away from it. */}
        <MarketsRailMobile className="order-first md:hidden" />

        {/* Price chart */}
        <PriceChart className="order-1 h-[520px] min-w-0 md:[grid-column:2] md:[grid-row:1] lg:h-auto lg:min-h-0" />

        {/* Markets rail — desktop sidebar (md+); replaced by the dropdown on mobile. */}
        <MarketsRail className="hidden md:flex md:min-h-0 md:[grid-column:1] md:[grid-row:1/3]" />

        {/* Hot nations + active conflicts: side by side under the chart at md,
            right column at lg */}
        <div className="order-3 grid min-w-0 grid-cols-1 gap-px bg-line md:grid-cols-2 md:[grid-column:2] md:[grid-row:2] lg:grid-cols-1 lg:grid-rows-[minmax(0,1fr)_minmax(0,1.2fr)] lg:[grid-column:3] lg:[grid-row:1/3] lg:min-h-0">
          <HotNations className="md:max-h-none md:min-h-0 lg:min-h-0" />
          <Conflicts className="md:max-h-[300px] lg:max-h-none lg:min-h-0" />
        </div>

        {/* Bottom row: Global Feed + Market Trades side by side (stacked on mobile/md) */}
        <div className="order-4 grid min-w-0 grid-cols-1 gap-px bg-line md:grid-cols-2 md:[grid-column:1/3] md:[grid-row:3] lg:[grid-column:2] lg:[grid-row:2] lg:min-h-0">
          <Feed className="min-w-0 md:h-[420px] lg:h-auto lg:min-h-0" />
          <Transactions className="min-w-0 md:h-[420px] lg:h-auto lg:min-h-0" />
        </div>
      </main>
    </AppShell>
  );
}
