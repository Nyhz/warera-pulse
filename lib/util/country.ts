/** Game country codes that differ from flag-icons (ISO 3166-1) codes. */
const FLAG_ALIAS: Record<string, string> = { uk: "gb" };

/** Game country code → flag-icons class code (lowercase ISO 3166-1). */
export function flagIconCode(code: string): string {
  const c = code.trim().toLowerCase();
  return FLAG_ALIAS[c] ?? c;
}

/** Deterministic, readable chip/bar color from a country code. */
export function colorFromCode(code: string): string {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 48% 42%)`;
}
