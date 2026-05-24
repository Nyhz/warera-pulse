/**
 * Server-side gateway access shared by the trimming route handlers.
 * Routes through the keyed gateway, or public api2 when keyless.
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/** Fetch one tRPC query and return `result.data`. Uses Next's Data Cache. */
export async function gatewayQuery<T = unknown>(
  proc: string,
  input: unknown,
  revalidate: number,
): Promise<T | null> {
  const url = new URL(`${BASE}/${proc}`);
  if (input !== undefined && input !== null) url.searchParams.set("input", JSON.stringify(input));
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && BASE !== API2) headers["X-API-Key"] = KEY;
  const res = await fetch(url, { headers, next: { revalidate } });
  if (!res.ok) return null;
  const json = (await res.json()) as { result?: { data?: T } };
  return json.result?.data ?? null;
}
