/**
 * Server-side gateway config + access shared by every route handler. Routes
 * through the keyed gateway, or public api2 when keyless. These constants and
 * the header builder are the single source of truth for the upstream — every
 * route imports them rather than re-declaring the four lines.
 */
export const GATEWAY = "https://gateway.warerastats.io/trpc";
export const API2 = "https://api2.warera.io/trpc";
export const KEY = process.env.WARERA_API_KEY?.trim() || undefined;
export const BASE = process.env.WARERA_API_BASE?.trim() || (KEY ? GATEWAY : API2);

/** Request headers for a given base — attaches the API key only to the gateway. */
export function gatewayHeaders(base: string = BASE): Record<string, string> {
  const headers: Record<string, string> = { "User-Agent": "WarEraPulse/0.1" };
  if (KEY && base !== API2) headers["X-API-Key"] = KEY;
  return headers;
}

/**
 * Standard stale-while-revalidate response headers: serve the cached body for
 * `ttl` seconds, then keep serving it (and refresh in the background) for up to
 * `swr` more. One place to own the caching policy every live route shares.
 */
export function cacheHeaders(ttl: number, swr: number = ttl * 2): Record<string, string> {
  return { "cache-control": `public, s-maxage=${ttl}, stale-while-revalidate=${swr}` };
}

/**
 * Run a tRPC batch (`?batch=1`) of {proc,input} entries against one base and
 * return the raw array of `{ result? | error? }` envelopes (callers unwrap).
 * Throws on a non-OK response or non-array body so callers can fall back.
 */
export async function gatewayBatch(
  entries: { proc: string; input: unknown }[],
  revalidate: number,
  base: string = BASE,
): Promise<unknown[]> {
  const path = entries.map((e) => e.proc).join(",");
  const input = JSON.stringify(Object.fromEntries(entries.map((e, i) => [i, e.input])));
  const url = `${base}/${path}?batch=1&input=${encodeURIComponent(input)}`;
  const res = await fetch(url, { headers: gatewayHeaders(base), next: { revalidate } });
  if (!res.ok) throw new Error(`gateway batch ${res.status}`);
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) throw new Error("gateway batch: not an array");
  return json;
}

/**
 * Last successful payload per query URL — a resilience net. The WarEra gateway
 * occasionally flaps (200-wrapped 503s); rather than blank a panel, we serve the
 * last good value. Errors are never stored, so they can't poison this fallback.
 *
 * BEST-EFFORT ONLY: this Map lives in a single serverless instance's memory, so
 * it is NOT shared across instances and does NOT survive a cold start. The
 * durable layer is the shared Next Data Cache (`next: { revalidate }`); this is
 * just an extra in-process cushion for back-to-back flaps on a warm instance.
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
  const headers = gatewayHeaders(BASE);
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
