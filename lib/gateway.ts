/**
 * Server-side gateway access shared by the trimming route handlers.
 * Routes through the keyed gateway, or public api2 when keyless.
 */
const GATEWAY = "https://gateway.warerastats.io/trpc";
const API2 = "https://api2.warera.io/trpc";
const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/**
 * Last successful payload per query URL — a resilience net. The WarEra gateway
 * occasionally flaps (200-wrapped 503s); rather than blank a panel, we serve the
 * last good value. Errors are never stored, so they can't poison this fallback.
 * In-memory (per instance), layered on top of the shared Next Data Cache.
 */
const lastGood = new Map<string, unknown>();

/** Fetch one tRPC query and return `result.data`. Uses Next's Data Cache. */
export async function gatewayQuery<T = unknown>(
  proc: string,
  input: unknown,
  revalidate: number,
): Promise<T | null> {
  const url = new URL(`${BASE}/${proc}`);
  if (input !== undefined && input !== null) url.searchParams.set("input", JSON.stringify(input));
  const key = url.toString();
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && BASE !== API2) headers["X-API-Key"] = KEY;
  try {
    const res = await fetch(url, { headers, next: { revalidate } });
    if (res.ok) {
      const json = (await res.json()) as { result?: { data?: T }; error?: unknown };
      const data = json.error ? null : (json.result?.data ?? null);
      if (data != null) {
        lastGood.set(key, data);
        return data;
      }
    }
  } catch {
    // fall through
  }

  // Cached/transient error. Prefer the last good value; if we have none, the
  // shared Data Cache may be holding a stale error — bootstrap with one fresh,
  // uncached fetch so a recovered gateway isn't masked for the whole TTL.
  const cached = lastGood.get(key) as T | undefined;
  if (cached != null) return cached;
  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { result?: { data?: T }; error?: unknown };
      const data = json.error ? null : (json.result?.data ?? null);
      if (data != null) {
        lastGood.set(key, data);
        return data;
      }
    }
  } catch {
    // fall through
  }
  return null;
}
