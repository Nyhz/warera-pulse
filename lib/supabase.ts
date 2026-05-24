import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client (service role). Used by the price-history
 * ingestion + read routes. `null` when env isn't configured so routes can
 * degrade gracefully instead of throwing.
 *
 * Never import this from a Client Component — the service key must stay
 * server-side.
 */
const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export const supabase =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;
