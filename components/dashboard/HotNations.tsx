"use client";

import { useHotNations } from "@/lib/api/queries";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { formatCompact } from "@/lib/util/format";
import { Flag } from "@/components/ui/Flag";

export function HotNations({ className = "" }: { className?: string }) {
  const { nations, isLoading } = useHotNations(15);

  return (
    <Panel className={`flex flex-col overflow-hidden ${className}`}>
      <PanelHead title="🔥 Hot Nations" meta="WEEKLY DAMAGE" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && nations.length === 0 ? (
          <div className="px-3.5 py-6 text-center font-mono text-[11px] text-faint">
            Loading…
          </div>
        ) : (
          nations.map((n, i) => (
            <div
              key={`${n.code}-${i}`}
              className="flex items-center gap-2.5 border-b border-line px-3.5 py-2"
            >
              <span className="w-3 font-mono text-[11px] text-faint">{i + 1}</span>
              <Flag code={n.code} />
              <span className="truncate text-[11px] font-semibold text-txt">{n.name}</span>
              <span className="ml-auto font-mono text-[12px] font-bold tabular-nums text-down">
                🔥 {formatCompact(n.value)}
              </span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
