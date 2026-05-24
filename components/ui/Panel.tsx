import type { ReactNode } from "react";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`bg-panel ${className}`}>{children}</section>;
}

export function PanelHead({
  title,
  meta,
  badge,
}: {
  title: string;
  meta?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex h-[44px] shrink-0 items-center gap-2 border-b border-line px-3.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-dim">
        {title}
      </span>
      {badge ? <div className="ml-auto">{badge}</div> : null}
      {meta ? (
        <span className="ml-auto font-mono text-[10.5px] text-faint">{meta}</span>
      ) : null}
    </div>
  );
}

export function HotBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[2px] border border-down/40 bg-down/10 px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-[0.1em] text-down">
      {children}
    </span>
  );
}
