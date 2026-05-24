/** Browser-side tRPC fetch through our /api/wr proxy. */
export async function wrFetch<T>(proc: string, input?: unknown): Promise<T> {
  const qs = input !== undefined ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "";
  const res = await fetch(`/api/wr/${proc}${qs}`);
  const json = await res.json();
  if (json?.error) {
    throw new Error(json.error?.message ?? `tRPC error: ${proc}`);
  }
  if (!res.ok) {
    throw new Error(`tRPC ${proc} failed: ${res.status}`);
  }
  return json.result.data as T;
}
