/** Full-width "load more" row for mobile lists (replaces inner scroll). */
export function LoadMore({ onClick, remaining }: { onClick: () => void; remaining: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full border-t border-line py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-dim transition-colors hover:bg-panel2 hover:text-txt"
    >
      Load more{remaining > 0 ? ` · ${remaining}` : ""}
    </button>
  );
}
