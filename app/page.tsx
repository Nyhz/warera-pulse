import { Header } from "@/components/dashboard/Header";
import { Ticker } from "@/components/dashboard/Ticker";
import { MarketsRail } from "@/components/dashboard/MarketsRail";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { HotNations } from "@/components/dashboard/HotNations";
import { Conflicts } from "@/components/dashboard/Conflicts";
import { Feed } from "@/components/dashboard/Feed";
import { LiveStatus } from "@/components/dashboard/LiveStatus";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-[1920px] flex-col lg:h-dvh lg:overflow-hidden">
      <Header />
      <Ticker />

      {/* <768px: stacked (mobile).
          768–1024px: 2 columns [rail | chart+feed] with Hot Nations + Active
          Conflicts side by side as a full-width bottom row (page scrolls).
          ≥1024px: 3 columns locked to 100dvh. */}
      <main className="flex flex-1 flex-col gap-px bg-line md:grid md:grid-cols-[200px_minmax(0,1fr)] lg:min-h-0 lg:grid-cols-[248px_minmax(0,1fr)_360px]">
        {/* Left — markets rail (Economy / Military tabs), selects the chart */}
        <MarketsRail className="order-3 max-h-[360px] md:order-none md:max-h-none" />

        {/* Center — price chart over global feed */}
        <div className="order-1 flex min-h-0 min-w-0 flex-col gap-px bg-line md:order-none">
          <PriceChart className="h-[520px] lg:h-auto lg:min-h-0 lg:flex-[5]" />
          <Feed className="h-[420px] lg:h-auto lg:min-h-0 lg:flex-[2]" />
        </div>

        {/* Hot nations + active conflicts: right column at lg, bottom row at md */}
        <div className="order-2 grid min-w-0 grid-cols-1 gap-px bg-line md:order-none md:col-span-2 md:grid-cols-2 lg:col-span-1 lg:grid-cols-1 lg:grid-rows-[auto_minmax(0,1fr)] lg:min-h-0">
          <HotNations className="shrink-0 md:self-start lg:self-auto" />
          <Conflicts className="md:max-h-[460px] lg:max-h-none lg:min-h-0" />
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-4 py-2.5 text-[10.5px] tracking-[0.04em] text-faint">
        <LiveStatus />
        <span>Powered by the WarEra Gateway · supported by warerastats.io</span>
        <span className="w-[44px]" aria-hidden />
      </footer>
    </div>
  );
}
