/**
 * Single client poll cadence for the whole live UI. Matched to the server-side
 * cache revalidate window (10s) on every live route (snapshot, equipment,
 * transactions, topOrders) so the client never polls slower than the cache
 * refreshes — i.e. it always gets the freshest cached value, never one a few
 * seconds stale. Keep these in lockstep.
 */
export const POLL = 10_000;
