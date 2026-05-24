import { flagIconCode } from "@/lib/util/country";

/** Cross-platform country flag (flag-icons sprite, not OS emoji). */
export function Flag({ code, className = "" }: { code: string; className?: string }) {
  return (
    <span
      className={`fi fi-${flagIconCode(code)} inline-block h-3 w-[18px] rounded-[2px] bg-cover ${className}`}
      aria-hidden
    />
  );
}
