"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { sma, ema } from "@/lib/domain/indicators";
import {
  useDaySparks,
  useEconomyItems,
  useItemHistory,
  useTopOrders,
  type Timeframe,
} from "@/lib/api/queries";
import { useUIStore } from "@/lib/store/ui";
import type { Candle } from "@/lib/types";
import { Panel, PanelHead } from "@/components/ui/Panel";
import { arrow, formatCompact, formatPct, formatPrice, priceDecimals } from "@/lib/util/format";

const SMA_PERIOD = 20;
const EMA_PERIOD = 9;
const SMA_COLOR = "#d29922";
const EMA_COLOR = "#39c0d3";

function maLineData(
  candles: Candle[],
  values: (number | null)[],
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  candles.forEach((c, i) => {
    const v = values[i];
    if (v != null) out.push({ time: c.time as UTCTimestamp, value: v });
  });
  return out;
}

function Chart({
  candles,
  decimals,
  showSMA,
  showEMA,
}: {
  candles: Candle[];
  decimals: number;
  showSMA: boolean;
  showEMA: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || candles.length === 0) return;

    const chart: IChartApi = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#3d4757",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#141b26" },
        horzLines: { color: "#141b26" },
      },
      rightPriceScale: { borderColor: "#1a2230" },
      timeScale: { borderColor: "#1a2230", timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: "#39c0d3", labelBackgroundColor: "#0d121c" },
        horzLine: { color: "#39c0d3", labelBackgroundColor: "#0d121c" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#3fb950",
      downColor: "#f85149",
      wickUpColor: "#3fb950",
      wickDownColor: "#f85149",
      borderVisible: false,
      priceFormat: {
        type: "price",
        precision: decimals,
        minMove: Math.pow(10, -decimals),
      },
    });
    candleSeries.setData(
      candles.map(
        (c): CandlestickData => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }),
      ),
    );

    const closes = candles.map((c) => c.close);
    if (showSMA) {
      const s = chart.addSeries(LineSeries, {
        color: SMA_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      s.setData(maLineData(candles, sma(closes, SMA_PERIOD)));
    }
    if (showEMA) {
      const e = chart.addSeries(LineSeries, {
        color: EMA_COLOR,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      e.setData(maLineData(candles, ema(closes, EMA_PERIOD)));
    }

    chart.timeScale().fitContent();

    const fmt = (v: number) => v.toFixed(decimals);
    const setLegend = (c?: Candle) => {
      if (!legendRef.current || !c) return;
      const cu = c.close >= c.open;
      legendRef.current.innerHTML =
        `<span class="text-faint">O</span> ${fmt(c.open)}  ` +
        `<span class="text-faint">H</span> ${fmt(c.high)}  ` +
        `<span class="text-faint">L</span> ${fmt(c.low)}  ` +
        `<span class="text-faint">C</span> <span class="${cu ? "text-up" : "text-down"}">${fmt(c.close)}</span>`;
    };
    setLegend(candles[candles.length - 1]);
    chart.subscribeCrosshairMove((param) => {
      const bar = param.time
        ? (param.seriesData.get(candleSeries) as CandlestickData | undefined)
        : undefined;
      setLegend(
        bar
          ? { time: 0, open: bar.open, high: bar.high, low: bar.low, close: bar.close }
          : candles[candles.length - 1],
      );
    });

    return () => chart.remove();
  }, [candles, decimals, showSMA, showEMA]);

  return (
    <div className="relative h-full min-h-0 w-full flex-1">
      <div
        ref={legendRef}
        className="pointer-events-none absolute left-2 top-1 z-10 font-mono text-[10px] text-dim"
      />
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}

function Stat({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex-1 border-r border-line px-2.5 py-[7px] last:border-r-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-dim">
        {k}
      </div>
      <div
        className={`mt-0.5 font-mono text-[13px] font-bold tabular-nums ${
          muted ? "text-faint" : ""
        }`}
      >
        {v}
      </div>
    </div>
  );
}

function MaToggle({
  on,
  color,
  label,
  value,
  onClick,
}: {
  on: boolean;
  color: string;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-mono text-[10.5px] font-bold transition-opacity ${
        on ? "border-line" : "border-line opacity-40"
      }`}
    >
      <span className="h-[2px] w-3 rounded" style={{ background: color }} />
      <span style={{ color: on ? color : undefined }}>{label}</span>
      <span className="text-dim">{value}</span>
    </button>
  );
}

export function PriceChart({ className = "" }: { className?: string }) {
  const { items } = useEconomyItems();
  const selected = useUIStore((s) => s.selectedSymbol);
  const item = useMemo(
    () => items.find((i) => i.symbol === selected) ?? items[0],
    [items, selected],
  );
  const [showSMA, setShowSMA] = useState(true);
  const [showEMA, setShowEMA] = useState(true);
  const [tf, setTf] = useState<Timeframe>("week");

  const { candles: rawCandles, last } = useItemHistory(item?.symbol, tf);
  const { data: orders } = useTopOrders(item?.symbol ?? "", !!item);
  const { data: sparks } = useDaySparks();

  // Headline price is LIVE (15s snapshot); the chart bars are hourly history.
  const livePrice = item?.price ?? 0;

  // 24h stats (High/Low/Open) + % change from the ingested DB, with the live
  // price folded into the extremes so they stay current at 15s.
  const day = item ? sparks?.[item.symbol] : undefined;
  const open = day?.open ?? 0;
  const high = day ? Math.max(day.high, livePrice) : 0;
  const low = day ? (livePrice > 0 ? Math.min(day.low, livePrice) : day.low) : 0;
  const hasDay = !!day && open > 0;

  // Reflect the live price in the current (forming) hourly candle's close.
  const candles = useMemo(() => {
    if (!rawCandles.length || livePrice <= 0) return rawCandles;
    const cur = rawCandles[rawCandles.length - 1];
    const updated: Candle = {
      ...cur,
      close: livePrice,
      high: Math.max(cur.high, livePrice),
      low: Math.min(cur.low, livePrice),
    };
    return [...rawCandles.slice(0, -1), updated];
  }, [rawCandles, livePrice]);

  const ready = candles.length > 1;
  const price = livePrice > 0 ? livePrice : last;
  const decimals = priceDecimals(price || 1);
  const pctChange = open > 0 && price > 0 ? (price - open) / open : item?.change24h ?? 0;
  const up = pctChange >= 0;

  // Order book (depth ladder), spread and BUY/SELL pressure from the gateway.
  const LEVELS = 6;
  const bids = (orders?.buyOrders ?? []).slice(0, LEVELS);
  const asks = (orders?.sellOrders ?? []).slice(0, LEVELS);
  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;
  const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
  const spreadPct = spread != null && mid ? (spread / mid) * 100 : null;
  const maxQty = Math.max(1, ...bids.map((o) => o.quantity), ...asks.map((o) => o.quantity));
  const buyQty = (orders?.buyOrders ?? []).reduce((s, o) => s + o.quantity, 0);
  const sellQty = (orders?.sellOrders ?? []).reduce((s, o) => s + o.quantity, 0);
  const buy = buyQty + sellQty > 0 ? Math.round((buyQty / (buyQty + sellQty)) * 100) : 50;
  const sell = 100 - buy;

  const closes = candles.map((c) => c.close);
  const lastSma = ready ? sma(closes, SMA_PERIOD).at(-1) ?? null : null;
  const lastEma = ready ? ema(closes, EMA_PERIOD).at(-1) ?? null : null;

  return (
    <Panel className={`flex min-h-0 flex-col overflow-hidden ${className}`}>
      <PanelHead title={`Price · ${item?.symbol.toUpperCase() ?? ""}`} meta="LIVE · WARERA GATEWAY" />
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="flex shrink-0 items-start justify-between">
          <div>
            <div className="text-[12px] font-semibold text-dim">{item?.name}</div>
            <div className="font-mono text-[32px] font-bold leading-[1.05] tabular-nums">
              {formatPrice(price, decimals)} <span className="text-[13px] text-dim">cr</span>
            </div>
          </div>
          <div
            className={`text-right font-mono text-[14px] font-bold ${
              up ? "text-up" : "text-down"
            }`}
          >
            {arrow(pctChange)} {formatPct(pctChange)}
          </div>
        </div>

        <div className="mt-3 flex shrink-0 overflow-hidden rounded-[3px] border border-line">
          <Stat k="24h H" v={hasDay ? formatPrice(high, decimals) : "—"} />
          <Stat k="24h L" v={hasDay ? formatPrice(low, decimals) : "—"} />
          <Stat k="24h O" v={hasDay ? formatPrice(open, decimals) : "—"} />
          <Stat k="Bid" v={bestBid != null ? formatPrice(bestBid, decimals) : "—"} />
          <Stat k="Ask" v={bestAsk != null ? formatPrice(bestAsk, decimals) : "—"} />
          <Stat k="Spread" v={spread != null ? formatPrice(spread, decimals) : "—"} />
        </div>

        <div className="mt-2.5 flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex gap-0.5">
            {(["week", "month"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTf(t)}
                className={`rounded-[2px] border px-[11px] py-1 font-mono text-[11px] font-bold uppercase tracking-[0.06em] transition-colors ${
                  tf === t
                    ? "border-accent bg-accent text-[#06210d]"
                    : "border-line text-dim hover:text-txt"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span
            className="rounded-[2px] bg-up/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-up"
            title="historical candles · live price every 15s"
          >
            {tf === "week" ? "7D · 1H" : "30D · 12H"}
          </span>
          <div className="ml-auto flex gap-1.5">
            <MaToggle
              on={showSMA}
              color={SMA_COLOR}
              label={`SMA ${SMA_PERIOD}`}
              value={lastSma != null ? formatPrice(lastSma, decimals) : "—"}
              onClick={() => setShowSMA((v) => !v)}
            />
            <MaToggle
              on={showEMA}
              color={EMA_COLOR}
              label={`EMA ${EMA_PERIOD}`}
              value={lastEma != null ? formatPrice(lastEma, decimals) : "—"}
              onClick={() => setShowEMA((v) => !v)}
            />
          </div>
        </div>

        <div className="mt-2.5 min-h-0 flex-1">
          {!ready ? (
            <div className="flex h-full items-center justify-center px-6 text-center font-mono text-[12px] text-faint">
              Accruing price history…
            </div>
          ) : (
            <Chart candles={candles} decimals={decimals} showSMA={showSMA} showEMA={showEMA} />
          )}
        </div>

        {/* deep-link to the in-game market for this resource */}
        <div className="mt-2.5 grid shrink-0 grid-cols-2 gap-2">
          <a
            href={`https://app.warera.io/market/trading?itemCode=${item?.symbol ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-[3px] border border-up/40 bg-up/12 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-up transition-colors hover:bg-up/20"
          >
            Buy <span aria-hidden>↗</span>
          </a>
          <a
            href={`https://app.warera.io/market/trading?itemCode=${item?.symbol ?? ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-[3px] border border-down/40 bg-down/12 py-2 text-[12px] font-bold uppercase tracking-[0.14em] text-down transition-colors hover:bg-down/20"
          >
            Sell <span aria-hidden>↗</span>
          </a>
        </div>

        <div className="mt-2.5 flex shrink-0 flex-col">
          <div className="flex items-center justify-between px-1 pb-1 text-[8px] font-bold uppercase tracking-[0.12em]">
            <span className="text-up">Bids · {buy}%</span>
            <span className="font-mono text-faint">
              {spread != null
                ? `spread ${formatPrice(spread, decimals)}${spreadPct != null ? ` · ${spreadPct.toFixed(2)}%` : ""}`
                : "order book"}
            </span>
            <span className="text-down">{sell}% · Asks</span>
          </div>
          <div className="grid grid-cols-2 gap-px">
            <div className="flex flex-col gap-px">
              {bids.length === 0 ? (
                <div className="px-1.5 py-[3px] font-mono text-[10px] text-faint">—</div>
              ) : (
                bids.map((o, i) => (
                  <div key={i} className="relative flex items-center justify-between px-1.5 py-[2.5px]">
                    <span
                      className="absolute inset-y-0 right-0 rounded-[1px] bg-up/12"
                      style={{ width: `${(o.quantity / maxQty) * 100}%` }}
                      aria-hidden
                    />
                    <span className="relative z-10 font-mono text-[10.5px] font-bold tabular-nums text-up">
                      {formatPrice(o.price, decimals)}
                    </span>
                    <span className="relative z-10 font-mono text-[10px] tabular-nums text-dim">
                      {formatCompact(o.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex flex-col gap-px">
              {asks.length === 0 ? (
                <div className="px-1.5 py-[3px] text-right font-mono text-[10px] text-faint">—</div>
              ) : (
                asks.map((o, i) => (
                  <div key={i} className="relative flex items-center justify-between px-1.5 py-[2.5px]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-[1px] bg-down/12"
                      style={{ width: `${(o.quantity / maxQty) * 100}%` }}
                      aria-hidden
                    />
                    <span className="relative z-10 font-mono text-[10px] tabular-nums text-dim">
                      {formatCompact(o.quantity)}
                    </span>
                    <span className="relative z-10 font-mono text-[10.5px] font-bold tabular-nums text-down">
                      {formatPrice(o.price, decimals)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
