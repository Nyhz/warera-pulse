# WarEra Pulse

**Real-time market & conflict terminal for [warera.io](https://app.warera.io).**
A Bloomberg/TradingView-style dashboard: live resource prices, order books, candle
charts, equipment prices, active conflicts and "hot nations" — all in one 100dvh
terminal view.

> Powered by the WarEra Gateway · supported by [warerastats.io](https://warerastats.io)

---

## Features

- **Markets rail** — the 21 tradeable resources (live price + 24h sparkline) and the
  military equipment tiers (weapons T1–T6 + 5 armor slots ×6) with live prices.
- **Price panel** — candlestick chart (WEEK = 7d/1h, MONTH = 30d/12h) with SMA/EMA,
  24h High/Low/Open, a live order-book depth ladder (bid/ask/spread) and a deep-link
  to trade in-game. Headline price updates every 15s; candles are hourly.
- **Active conflicts** — live battles with ground points, tick countdown, damage
  share and a deep-link into each battle.
- **Hot nations** — weekly country-damage leaderboard.
- **Global feed** — war declarations, battles, alliances, region transfers, etc.
- Everything refreshes on a single **15s** cadence and pauses when the tab is hidden.

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind v4**
- **TanStack Query v5** (polling/cache) · **lightweight-charts 5** · **Zustand** · **Zod**
- **Supabase** (Postgres) for price history · **Vercel** hosting (region `dub1`)

## Architecture

All game data comes through the **WarEra gateway** (`gateway.warerastats.io`, with
the public `api2.warera.io` as a keyless fallback). The key never reaches the browser.

- **`/api/snapshot`** — the whole live UI in **one batched tRPC call** (prices,
  battles, events, ranking, wage, dates), trimmed server-side. Cached in Next's
  **Data Cache** (revalidate 10s) so the gateway is hit at most once per window and
  the CDN fans the cached copy out to every client — never per-user.
- **`/api/equipment`** — equipment average prices (`gameStat.getEquipmentAvgByCode`),
  36 codes in one batched call.
- **`/api/wr/[proc]`** — generic cached proxy for the static country/region maps and
  per-item top orders.
- **Price history** is the only thing persisted: a scheduled `POST /api/ingest`
  (every ~10 min, via [cron-job.org](https://cron-job.org)) appends a snapshot of the
  21 prices to Supabase (`price_history`, 30-day retention). `/api/history/[symbol]`
  reconstructs hourly/12h OHLC candles from it. The live price still comes from the
  15s snapshot; the chart only adds a historical bar.

Rate-limit strategy: the gateway token allows 200 req/min; the shared Data Cache +
unified 15s client polling keep usage far below it regardless of traffic.

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Create `.env.local`:

```bash
WARERA_API_KEY=...                 # warerastats.io gateway key (server-side only)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...      # service_role (server-side only, bypasses RLS)
INGEST_SECRET=...                  # shared secret for the /api/ingest endpoint
# NEXT_PUBLIC_SITE_URL=https://your-domain   # optional, for canonical/OG URLs
```

### Database

Run [`db/schema.sql`](db/schema.sql) once in the Supabase SQL editor (it creates
`price_history` with RLS enabled — the app uses the service role, which bypasses RLS).

### Scheduled ingestion

Point an external scheduler at the deployed endpoint (Vercel Hobby cron is daily-only):

- **cron-job.org** → `POST https://<your-domain>/api/ingest`, every 10 min,
  header `Authorization: Bearer <INGEST_SECRET>`.

## Deploy

Push to a repo connected to **Vercel**. Set the same env vars in the project settings.
Functions are pinned to `dub1` (Dublin / eu-west-1) via `vercel.json` to sit next to
Supabase.

## Credits

Game data via the **WarEra gateway** (`warerastats.io`). WarEra is a browser game by
its respective owners; this is an unofficial, read-only fan dashboard.
