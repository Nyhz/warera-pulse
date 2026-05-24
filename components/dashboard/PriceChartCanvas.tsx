"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { sma, ema, SMA_PERIOD, EMA_PERIOD, SMA_COLOR, EMA_COLOR } from "@/lib/domain/indicators";
import type { Candle } from "@/lib/types";

/**
 * lightweight-charts canvas, isolated so it can be dynamically imported (keeps
 * the ~heavy charting lib out of the initial bundle).
 *
 * The full candle set (DB, ~5min cadence) is set with setData when it changes;
 * the live price (10s) updates ONLY the last forming bar via series.update —
 * no chart rebuild, so the user's zoom/pan and the view are preserved.
 */
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

export function Chart({
  candles,
  livePrice,
  decimals,
  showSMA,
  showEMA,
}: {
  candles: Candle[];
  livePrice: number;
  decimals: number;
  showSMA: boolean;
  showEMA: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const smaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Latest candles, readable from the (stable) crosshair handler without
  // resubscribing — so a candle-data update never rebuilds the chart.
  const candlesRef = useRef<Candle[]>(candles);
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // STRUCTURE: build the chart + series. Rebuilds ONLY on structural changes
  // (price precision or which MA lines exist) — never on a candle-data tick.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
    chartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#3fb950",
      downColor: "#f85149",
      wickUpColor: "#3fb950",
      wickDownColor: "#f85149",
      borderVisible: false,
      priceFormat: { type: "price", precision: decimals, minMove: Math.pow(10, -decimals) },
    });
    seriesRef.current = candleSeries;

    const maOpts = {
      lineWidth: 1 as const,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    };
    smaRef.current = showSMA ? chart.addSeries(LineSeries, { color: SMA_COLOR, ...maOpts }) : null;
    emaRef.current = showEMA ? chart.addSeries(LineSeries, { color: EMA_COLOR, ...maOpts }) : null;

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
    chart.subscribeCrosshairMove((param) => {
      const bar = param.time
        ? (param.seriesData.get(candleSeries) as CandlestickData | undefined)
        : undefined;
      const cur = candlesRef.current;
      setLegend(
        bar
          ? { time: 0, open: bar.open, high: bar.high, low: bar.low, close: bar.close }
          : cur[cur.length - 1],
      );
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      smaRef.current = null;
      emaRef.current = null;
    };
  }, [decimals, showSMA, showEMA]);

  // DATA: push candles + MA lines via setData (no rebuild, zoom/pan preserved).
  // Also re-runs after a structural rebuild to repopulate the fresh series.
  useEffect(() => {
    const s = seriesRef.current;
    if (!s || candles.length === 0) return;
    s.setData(
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
    smaRef.current?.setData(maLineData(candles, sma(closes, SMA_PERIOD)));
    emaRef.current?.setData(maLineData(candles, ema(closes, EMA_PERIOD)));
    chartRef.current?.timeScale().fitContent();

    const last = candles[candles.length - 1];
    if (legendRef.current && last) {
      const fmt = (v: number) => v.toFixed(decimals);
      const cu = last.close >= last.open;
      legendRef.current.innerHTML =
        `<span class="text-faint">O</span> ${fmt(last.open)}  ` +
        `<span class="text-faint">H</span> ${fmt(last.high)}  ` +
        `<span class="text-faint">L</span> ${fmt(last.low)}  ` +
        `<span class="text-faint">C</span> <span class="${cu ? "text-up" : "text-down"}">${fmt(last.close)}</span>`;
    }
  }, [candles, decimals, showSMA, showEMA]);

  // Live tick: update only the last (forming) bar — no rebuild, view preserved.
  useEffect(() => {
    const s = seriesRef.current;
    const last = candles[candles.length - 1];
    if (!s || !last || livePrice <= 0) return;
    s.update({
      time: last.time as UTCTimestamp,
      open: last.open,
      high: Math.max(last.high, livePrice),
      low: Math.min(last.low, livePrice),
      close: livePrice,
    });
  }, [livePrice, candles]);

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
