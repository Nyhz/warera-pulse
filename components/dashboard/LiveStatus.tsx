"use client";

import { useItemPrices } from "@/lib/api/queries";

/** Live feed indicator — reflects the price query: LIVE / SYNC / ERROR. */
export function LiveStatus() {
  const { data, isError, isLoading } = useItemPrices();
  const s =
    isError || (!isLoading && !data)
      ? { label: "ERROR", color: "text-down", dot: "bg-down" }
      : isLoading || !data
        ? { label: "SYNC", color: "text-amber", dot: "bg-amber" }
        : { label: "LIVE", color: "text-up", dot: "bg-up" };

  return (
    <span className={`inline-flex items-center gap-[6px] font-bold ${s.color}`}>
      <span
        className={`live-dot h-[7px] w-[7px] animate-[pulse-ring_2s_infinite] rounded-full ${s.dot}`}
      />
      {s.label}
    </span>
  );
}
