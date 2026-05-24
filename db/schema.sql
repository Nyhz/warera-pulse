-- WarEra Pulse — price history schema.
-- Run this once in the Supabase SQL editor (SQL → New query → Run).
--
-- Only PRICES are ingested (every ~15 min via GitHub Actions → /api/ingest).
-- Everything else in the app stays live through the gateway.

create table if not exists price_history (
  id        bigint generated always as identity primary key,
  item_code text             not null,
  ts        timestamptz      not null default now(),
  price     double precision not null
);

-- Fast "last 7 days for one item, oldest→newest" reads.
create index if not exists price_history_code_ts_idx
  on price_history (item_code, ts);

-- Lock down public (anon/authenticated) access. The app only ever touches this
-- table server-side with the service_role key, which bypasses RLS — so ingest
-- and reads keep working with zero policies.
alter table price_history enable row level security;

-- Equipment market floor prices: a shared, persistent cache of the auth-gated
-- itemOffer.getItemOffers (BYOT). One row per item (upsert) → always ≤36 rows,
-- never grows. Refreshed by any visitor who connects a token; everyone reads it.
create table if not exists equipment_offers (
  item_code  text primary key,
  floor      double precision not null,
  attack     double precision,
  crit       double precision,
  state      double precision,
  updated_at timestamptz      not null default now()
);

alter table equipment_offers enable row level security;

-- Optional housekeeping: drop rows older than 30 days to stay tiny.
-- Schedule via Supabase cron (pg_cron) or run manually:
--   delete from price_history where ts < now() - interval '30 days';
