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
    <div className="mx-auto flex w-full max-w-[1920px] flex-col md:h-dvh md:overflow-hidden">
      <Header />
      <Ticker />

      {/* 3 columns from md (768px) up — narrower sides in the 768–1024 range,
          full widths at lg+. Below 768px the panels stack (mobile). */}
      <main className="flex flex-1 flex-col gap-px bg-line md:grid md:min-h-0 md:grid-cols-[180px_minmax(0,1fr)_280px] lg:grid-cols-[248px_minmax(0,1fr)_360px]">
        {/* Left — markets rail (Economy / Military tabs), selects the chart */}
        <MarketsRail className="order-3 max-h-[360px] md:order-none md:max-h-none" />

        {/* Center — price chart over global feed */}
        <div className="order-1 flex min-h-0 min-w-0 flex-col gap-px bg-line md:order-none">
          <PriceChart className="h-[520px] md:h-auto md:min-h-0 md:flex-[5]" />
          <Feed className="md:min-h-0 md:flex-[2]" />
        </div>

        {/* Right — hot nations over active conflicts */}
        <div className="order-2 flex min-h-0 min-w-0 flex-col gap-px bg-line md:order-none">
          <HotNations className="shrink-0" />
          <Conflicts className="md:min-h-0 md:flex-1" />
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
