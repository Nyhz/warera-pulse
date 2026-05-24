# WarEra Pulse — Technical Spec

> Real-time geopolitical terminal for **warera.io**. Market data + active-conflict health, with event correlation. Bloomberg/TradingView aesthetic, gamer audience.

---

## Stack

- **Next.js 15** (App Router, TypeScript, RSC where reasonable)
- **Tailwind CSS v4**
- **TanStack Query v5** — server state, polling, cache
- **lightweight-charts** (TradingView's free lib) — price charts & candles
- **Framer Motion** — UI transitions, health bars, feed item entry
- **GSAP** — chart event-marker animations, ticker tape, scrubber (phase 2)
- **Zustand** — UI state (selected item, focused country)
- **Zod** — runtime API schema validation
- Deploy: **Vercel** (or self-hosted on Mac Mini via launchd)

---

## Data sources

**Base URL:** `https://gateway.warerastats.io/trpc/` — drop-in replacement for `https://api2.warera.io/trpc/` with batching, dedup, and local-DB endpoints. Attribute "Supported by warerastats.io" in the footer.

**Key endpoints (tRPC, 38 total across 20 namespaces):**

| Namespace             | Procedure                  | Use                                          |
| --------------------- | -------------------------- | -------------------------------------------- |
| `country`             | `getAllCountries`          | Country list, populations, regions           |
| `country`             | `getCountryById`           | Country details                              |
| `government`          | `getByCountryId`           | Gov, laws, tax policy                        |
| `battle`              | `getMany({ isActive })`    | Active battles with round/tick/terrain       |
| `itemTrading`         | `getPrices`                | Current item prices                          |
| `events`*             | `getByCountry`             | Country events (war, revolt, law, etc.)      |
| `articles`*           | `getDaily/Weekly/Top`      | News feed                                    |
| `transactions`*       | `getMany`                  | **All trades with participants** (OHLC src)  |
| `workOffers`*         | `search`                   | Job market                                   |
| `ranking`             | `get({ type })`            | Leaderboards                                 |
| `search`              | `global`                   | Cross-entity search                          |

`*` Endpoints with local-DB scrape on the gateway — instant response, no API hit.

**Cache hints (already enforced by gateway):**
- Most endpoints: 5 min
- Item prices: 10 min
- Battle ranking: 2 min

**Client polling cadences:**
- `itemTrading.getPrices`: 30 s
- `battle.getMany`: 15 s (battles tick every 2 min, oversample for momentum smoothing)
- Events feed: 60 s
- Country list: 5 min

Use a single TanStack Query client with **per-query staleTime** matching the gateway's cache so we don't waste round-trips.

---

## Architecture

```
/app
  /(dashboard)
    page.tsx              # main grid (server component shell)
    loading.tsx
  /item/[symbol]
    page.tsx              # deep view per commodity
/components
  /header                 # live indicator, game day, server time
  /ticker                 # auto-scrolling price tape
  /chart                  # price chart + event markers
  /conflicts              # active-battle cards
  /feed                   # global event stream
/lib
  /api
    client.ts             # tRPC fetch wrapper (gateway base URL)
    queries.ts            # TanStack Query hooks (typed)
    schemas.ts            # Zod schemas per endpoint
  /domain
    health.ts             # composite country-health score
    ohlc.ts               # OHLC bucket reconstruction from transactions
    correlation.ts        # link price moves ↔ events (phase 2)
  /store
    ui.ts                 # Zustand: selectedItem, focusedCountryId
  /util
    format.ts             # number / date formatting (always rounded)
    timeSync.ts           # client-server clock offset
```

---

## MVP scope (v0.1 — target 2 weeks)

### Header
Live status dot (green = polling OK, amber = stale, red = error). Game day from `gameConfig.getDates`. Synced server clock.

### Ticker tape
- Top 8 items by 24h price change magnitude (computed client-side from prices history we keep in memory across polls)
- Item symbol, current price, 24h delta with up/down icon and semantic color
- Pure CSS scroll (`@keyframes translateX(-50%)` on duplicated content), no JS
- Click an item → set as chart focus

### Price chart
- 24h line chart for the selected item (default: top mover)
- Refresh on each `getPrices` poll, with the latest point pulsing
- Y-axis auto-scale; X-axis: 24h window with 6h gridlines
- Empty state: "No trades in the last 24h"

### Active conflicts panel
- Card per active battle (cap at 5, sorted by total terrain at stake)
- Two-country header with code chips, round + tick indicator
- Terrain bars with momentum (Δ damage/tick averaged over last 5 ticks)
- MU count, winning side highlighted

### Event feed
- Last 45 min, deduplicated, capped at 20 items
- Surface: war declarations, large price moves (>3% in <1h), battle round transitions, NAPs/alliances
- Tabler icon per event type, timestamp, plain-language summary
- Filter chips at top (all / war / market / diplomacy)

---

## Phase 2 (v0.2)

- **OHLC reconstruction** — Pull `transactions` paginated history per item, bucket into 1h / 4h / 1d candles in `lib/domain/ohlc.ts`. Switch chart from line → candles via lightweight-charts.
- **Event correlation markers** — Vertical lines on chart at war events / NAPs in the visible window; tooltip with event summary. GSAP timeline syncs marker entry with chart redraw.
- **Country health score** — Composite 0–100 per country in conflict: weighted sum of (terrain trend over last 30 min) × 0.35, (core regions held / total) × 0.25, (allied vs enemy MU damage ratio) × 0.20, (treasury delta) × 0.10, (population morale proxy) × 0.10. Display as animated SVG dial (Framer Motion).
- **Watchlist + Telegram alerts** — User picks items / countries, sets thresholds, gets pinged via existing Telegram bot. Persist watchlist in `localStorage` for v0.2; add Supabase + auth in v0.3 if needed.
- **Battle replay scrubber** — GSAP timeline scrubs through tick history for a closed battle, animating terrain bars and damage flow.

---

## Out of scope (lock down)

- Auth / user accounts (v0.1 is public, read-only)
- Trading actions (no public API exists for it)
- Native mobile app (responsive web only — design for 1440px and 390px breakpoints)
- Server-side persistence beyond the gateway's cache
- i18n (English-only v0.1, Spanish added v0.2)

---

## Quality bars

- First meaningful paint < 1.5 s on cable
- Initial JS bundle < 200 KB gzipped
- Every displayed number passes through a rounding formatter — no `0.1 + 0.2 = 0.30000004` leaks
- Dark mode default, light mode honored via `prefers-color-scheme`
- All animations respect `prefers-reduced-motion`
- Empty + error states for every panel (don't show skeletons forever)
- Lighthouse a11y ≥ 95

---

## Implementation notes

- Port API types from the existing **`warera-client`** PyPI package's Pydantic models — gives you ground truth without reverse-engineering. Translate to Zod.
- Sync client to server time on mount using `gameConfig.getDates` so tick boundaries align; otherwise polling lands mid-tick and momentum reads choppy.
- Don't rely on color alone for up/down — pair semantic color with an arrow icon (a11y + protanopia).
- For the ticker, duplicate the items list inline (`[...items, ...items]`) — keeps animation seamless without JS.
- Footer attribution: "Powered by the WarEra Gateway · supported by warerastats.io"

---

## Day-one task list for Claude Code

1. `pnpm create next-app` with TS + Tailwind + App Router
2. Install: `@tanstack/react-query lightweight-charts framer-motion gsap zustand zod`
3. Scaffold `/lib/api/client.ts` pointing at the gateway, with a single `getPrices` query hook
4. Render a static ticker with mock data, confirm CSS scroll loop works
5. Wire ticker to live `getPrices` data, with delta computed client-side from the in-memory price history
6. Add active-battles panel with mock data → wire to `battle.getMany({ isActive: true })`
7. Add chart (line, single item) → wire to historical price data
8. Add events feed → wire to `events` local-DB endpoint
9. Polish header, dark mode, empty states
10. Deploy to Vercel, share on the WarEra Discord
