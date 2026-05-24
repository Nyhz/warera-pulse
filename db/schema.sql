-- WarEra Pulse — price history schema.
-- Run this once in the Supabase SQL editor (SQL → New query → Run).
--
-- Only the 21 resource PRICES are ingested (every ~10 min via cron-job.org →
-- /api/ingest). Everything else (incl. equipment prices) stays live through the
-- gateway, so this is the only table the app needs.

create table if not exists price_history (
  id        bigint generated always as identity primary key,
  item_code text             not null,
  ts        timestamptz      not null default now(),
  price     double precision not null
);

-- Fast "last 7 days for one item, oldest→newest" reads (per-item history).
create index if not exists price_history_code_ts_idx
  on price_history (item_code, ts);

-- Fast "last 24h across ALL items" reads (the sparks query filters on ts only,
-- so it can't use the composite index above — its leading column is item_code).
create index if not exists price_history_ts_idx
  on price_history (ts);

-- Lock down public (anon/authenticated) access. The app only ever touches this
-- table server-side with the service_role key, which bypasses RLS — so ingest
-- and reads keep working with zero policies.
alter table price_history enable row level security;

-- Optional housekeeping: drop rows older than 30 days to stay tiny.
-- Schedule via Supabase cron (pg_cron) or run manually:
--   delete from price_history where ts < now() - interval '30 days';

-- ---------------------------------------------------------------------------
-- Aggregation done in Postgres (instead of pulling thousands of raw rows into
-- the Node route and bucketing there). The /api/history and /api/spark routes
-- call these via supabase.rpc(); if the function is missing they fall back to
-- JS bucketing, so it's safe to deploy the app before running this migration.
-- ---------------------------------------------------------------------------

-- OHLC candles for one item: open = first sample in the bucket, close = last,
-- high/low = extremes. `p_bucket` is the candle width in seconds (3600 = 1h).
create or replace function price_candles(p_symbol text, p_since timestamptz, p_bucket int)
returns table (t bigint, open double precision, high double precision, low double precision, close double precision)
language sql stable as $$
  with rows as (
    select (floor(extract(epoch from ts) / p_bucket) * p_bucket)::bigint as t, ts, price
    from price_history
    where item_code = p_symbol and ts >= p_since
  )
  select
    t,
    (array_agg(price order by ts asc))[1]  as open,
    max(price)                              as high,
    min(price)                              as low,
    (array_agg(price order by ts desc))[1]  as close
  from rows
  group by t
  order by t;
$$;

-- Last-window trend for every item at once: hourly close points (for the rail
-- sparklines) + open/high/low over the whole window (for the 24h stats).
create or replace function price_sparks(p_since timestamptz)
returns table (item_code text, points double precision[], open double precision, high double precision, low double precision)
language sql stable as $$
  with rows as (
    select item_code, ts, price, (floor(extract(epoch from ts) / 3600) * 3600)::bigint as hour
    from price_history
    where ts >= p_since
  ),
  hour_close as (
    select item_code, hour, (array_agg(price order by ts desc))[1] as close
    from rows group by item_code, hour
  ),
  pts as (
    select item_code, array_agg(close order by hour) as points
    from hour_close group by item_code
  ),
  stats as (
    select item_code,
      (array_agg(price order by ts asc))[1] as open,
      max(price) as high,
      min(price) as low
    from rows group by item_code
  )
  select p.item_code, p.points, s.open, s.high, s.low
  from pts p join stats s using (item_code);
$$;
