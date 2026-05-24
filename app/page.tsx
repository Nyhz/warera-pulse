import { AppShell } from "@/components/dashboard/AppShell";
import { Ticker } from "@/components/dashboard/Ticker";
import { MarketsRail } from "@/components/dashboard/MarketsRail";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { HotNations } from "@/components/dashboard/HotNations";
import { Conflicts } from "@/components/dashboard/Conflicts";
import { Feed } from "@/components/dashboard/Feed";

export default function Home() {
  return (
    <AppShell fill>
      <Ticker />

      {/* Mobile (<768px): stacked — chart, then markets rail (so you can switch
          resource right under the chart), then conflicts/nations, feed last.
          768–1024px: 2 columns [rail | chart+feed] + Hot Nations & Active
          Conflicts side by side as a full-width bottom row (page scrolls).
          ≥1024px: 3 columns locked to 100dvh (chart 5fr over feed 2fr). */}
      <main className="flex flex-1 flex-col gap-px bg-line md:grid md:grid-cols-[200px_minmax(0,1fr)] md:[grid-template-rows:520px_300px] lg:min-h-0 lg:grid-cols-[248px_minmax(0,1fr)_360px] lg:[grid-template-rows:minmax(0,5fr)_minmax(0,2fr)]">
        {/* Price chart */}
        <PriceChart className="order-1 h-[520px] min-w-0 md:[grid-column:2] md:[grid-row:1] lg:h-auto lg:min-h-0" />

        {/* Markets rail — directly below the chart on mobile to switch resource.
            min-h-0 so it doesn't inflate the grid rows (its list scrolls instead). */}
        <MarketsRail className="order-2 max-h-[360px] md:max-h-none md:min-h-0 md:[grid-column:1] md:[grid-row:1/3]" />

        {/* Hot nations + active conflicts: side by side under the chart at md,
            right column at lg */}
        <div className="order-3 grid min-w-0 grid-cols-1 gap-px bg-line md:grid-cols-2 md:[grid-column:2] md:[grid-row:2] lg:grid-cols-1 lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-column:3] lg:[grid-row:1/3] lg:min-h-0">
          <HotNations className="shrink-0 md:min-h-0 lg:self-auto" />
          <Conflicts className="md:max-h-[300px] lg:max-h-none lg:min-h-0" />
        </div>

        {/* Global feed — full-width bottom row at md, col 2 row 2 at lg, last on mobile */}
        <Feed className="order-4 h-[420px] min-w-0 md:[grid-column:1/3] md:[grid-row:3] lg:[grid-column:2] lg:[grid-row:2] lg:h-auto lg:min-h-0" />
      </main>
    </AppShell>
  );
}
