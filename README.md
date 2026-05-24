<p align="center">
  <img src="public/logo.webp" alt="WarEra Pulse" width="440" />
</p>

<h1 align="center">WarEra Pulse</h1>

<p align="center">
  <strong>Live market &amp; war terminal for <a href="https://warera.io">warera.io</a></strong><br/>
  Resource prices, order books, candle charts, equipment prices, active battles and hot nations —<br/>
  in one Bloomberg-style terminal that never makes you scroll.
</p>

<p align="center">
  <a href="https://www.warera-pulse.info"><img src="https://img.shields.io/badge/live-warera--pulse.info-3fb950?style=flat-square" alt="Live site" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/Supabase-Postgres-3ecf8e?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
</p>

---

## ✦ What it is

**WarEra Pulse** is a read-only, real-time dashboard over the data of the browser game
[WarEra](https://warera.io). It pulls the game's market and war state through a cached
server proxy and renders it as a trading-terminal UI: a scrolling price ticker, candle
charts with moving averages, a live order-book ladder, active-battle cards, a global
events feed, and per-player economics.

It is **not** affiliated with WarEra — it's a fan-built terminal powered by the
public [warerastats.io](https://warerastats.io) gateway.

## ✦ Features

| Page | What you get |
|------|--------------|
| **`/` — Markets** | Live ticker for all 21 resources · markets rail (economy + military tabs) · candle chart with **SMA/EMA**, week/month timeframes and a live forming bar · order-book ladder with spread + buy/sell pressure · **Hot Conflicts**, **Hot Nations**, **Global Feed** (with per-country filter) and **Market Trades** |
| **`/economy`** | **Refining-margin calculator** (margin per production point, buy-inputs vs. full-chain) · **Nations economy** table ranked by production bonus, development or income tax |
| **`/citizen`** | Per-player economic dashboard: identity + avatar · **net-worth breakdown** · economy skills · owned-companies table with production, levels, estimated value, **net income/day**, **payback** and a **wage-vs-market** badge |

Highlights under the hood:

- 🛰 **One batched snapshot** drives the entire live UI — a single poll updates every panel.
- ⚡ **Edge-cached proxy**: thousands of users still hit the game gateway at most once per cache window.
- 📈 **Self-hosted price history** — the game has no OHLC endpoint, so candles are reconstructed from ingested samples.
- 😴 **Polling pauses** when the tab is hidden, so idle tabs cost nothing.

## ✦ Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) · **React 19** · **TypeScript 6**
- **[Tailwind CSS v4](https://tailwindcss.com)** for styling, **[lightweight-charts 5](https://tradingview.github.io/lightweight-charts/)** for candles
- **[TanStack Query 5](https://tanstack.com/query)** for polling/cache · **[Zustand 5](https://zustand-demo.pmnd.rs/)** for UI + session-history state
- **[Supabase](https://supabase.com)** (Postgres) for the ingested price history
- **[Vitest](https://vitest.dev)** for unit tests · **[flag-icons](https://flagicons.lipis.dev)** for country flags

## ✦ Architecture

```
Browser ──poll 10s──▶  Next.js route handlers  ──cached──▶  WarEra gateway
                       (/api/*, hide key,                   (gateway.warerastats.io,
                        trim + cache)                        X-API-Key)

cron-job.org ──10min──▶  /api/ingest  ──▶  Supabase  ──▶  /api/history · /api/spark
                         (21 prices)        price_history       (OHLC candles)
```

- **`/api/snapshot`** — the whole live UI in one batched gateway call (prices, battles, events,
  ranking, wages). Validated **once per poll** and read by every panel via `useSnapshot`.
- **Server proxy** keeps the API key server-side, caches via the shared **Next Data Cache**
  (stale-while-revalidate), and trims payloads before they reach the browser.
- **Price history** is the only persisted data: ingested every ~10 min into Supabase and
  bucketed into candles **in Postgres** (`price_candles` / `price_sparks`), with a JS fallback.
- **Polling cadence** (10 s) is kept in lockstep with the server cache TTL, and pauses on hidden tabs.

```
lib/
├─ api/          snapshot · reference · history · citizen · market · types · config · client
├─ domain/       indicators (SMA/EMA) · battles · nations
├─ util/         format · ohlc · country
├─ store/        history (session prices) · ui (selected symbol)
├─ catalog · gateway · supabase · site
components/      dashboard/ · citizen/ · economy/ · ui/
app/             page (markets) · economy · citizen · api/*
db/schema.sql    price_history table, indexes + aggregation functions
```

## ✦ Getting started

> Requires **Node 20+** and **pnpm**.

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app runs **without any keys** — it falls back to WarEra's public API. To unlock the
keyed gateway and self-hosted price history, create a `.env.local` with the variables below.

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `WARERA_API_KEY` | optional | Routes through the keyed `gateway.warerastats.io` (200 req/min). Without it, falls back to the public `api2.warera.io`. **Server-side only — never exposed to the browser.** |
| `SUPABASE_URL` | for history | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for history | Service-role key (server-only; bypasses RLS) |
| `INGEST_SECRET` | for history | Bearer token the ingest cron must present to `POST /api/ingest` |
| `WARERA_API_BASE` | optional | Override the upstream base URL |
| `NEXT_PUBLIC_SITE_URL` | optional | Canonical URL for metadata/OG |

### Price history setup (optional)

1. Run [`db/schema.sql`](db/schema.sql) once in the Supabase SQL editor (creates the
   `price_history` table, indexes and the `price_candles` / `price_sparks` functions).
2. Point an external scheduler such as **[cron-job.org](https://cron-job.org)** at
   `POST https://<your-app>/api/ingest` every ~10 min, with header
   `Authorization: Bearer <INGEST_SECRET>`.
3. Charts fill in as samples accrue (≈2 hours of uptime for the first few candles); until
   then the chart uses an in-session price buffer.

## ✦ Scripts

| Command | Does |
|---------|------|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Run the Vitest unit suite |

## ✦ Deployment

Deployed on **Vercel**. Functions are pinned to **`dub1` (Dublin / eu-west-1)** via
[`vercel.json`](vercel.json) to sit next to the Supabase region and keep DB round-trips fast.
Set the environment variables in the Vercel project, run the Supabase schema, and wire up
the ingest cron as above.

---

<p align="center"><sub>Powered by the WarEra Gateway · supported by warerastats.io · not affiliated with WarEra</sub></p>
