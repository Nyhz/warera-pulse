/** Game country codes that differ from flag-icons (ISO 3166-1) codes. */
const FLAG_ALIAS: Record<string, string> = { uk: "gb" };

/** Game country code → flag-icons class code (lowercase ISO 3166-1). */
export function flagIconCode(code: string): string {
  const c = code.trim().toLowerCase();
  return FLAG_ALIAS[c] ?? c;
}
