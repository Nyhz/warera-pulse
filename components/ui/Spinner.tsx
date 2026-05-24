/** Minimal terminal-style spinner ring (accent top on a line-colored ring). */
export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-2 border-line border-t-accent ${className}`}
    />
  );
}
