"use client";

import type { Item } from "@/lib/types";
import { useEconomyItems } from "@/lib/api/snapshot";
import { arrow, formatPct, formatPrice } from "@/lib/util/format";
import { ItemIcon } from "@/components/ui/ItemIcon";

function Tk({ item, hidden }: { item: Item; hidden?: boolean }) {
  const up = item.change24h >= 0;
  return (
    <div
      aria-hidden={hidden}
      className="flex flex-none items-center gap-2 whitespace-nowrap border-r border-line px-4 py-2"
    >
      <ItemIcon code={item.symbol} className="h-5 w-5 rounded-[2px]" />
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-dim">
        {item.symbol}
      </span>
      <span className="font-mono text-[14px] font-bold tabular-nums">
        {formatPrice(item.price)}
      </span>
      <span
        className={`font-mono text-[11.5px] font-semibold tabular-nums ${
          up ? "text-up" : "text-down"
        }`}
      >
        {arrow(item.change24h)} {formatPct(Math.abs(item.change24h))}
      </span>
    </div>
  );
}

export function Ticker() {
  const { items } = useEconomyItems();
  return (
    <div
      className="relative overflow-hidden border-b border-line bg-panel2"
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent)",
      }}
    >
      <div className="marquee-track flex w-max animate-[marquee_60s_linear_infinite] hover:[animation-play-state:paused]">
        {items.map((item) => (
          <Tk key={item.symbol} item={item} />
        ))}
        {items.map((item) => (
          <Tk key={`dup-${item.symbol}`} item={item} hidden />
        ))}
      </div>
    </div>
  );
}
