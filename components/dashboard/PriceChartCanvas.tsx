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
import { sma, ema } from "@/lib/domain/indicators";
import type { Candle } from "@/lib/types";

/**
 * lightweight-charts canvas, isolated so it can be dynamically imported (keeps
 * the ~heavy charting lib out of the initial bundle).
 *
 * The full candle set (DB, ~5min cadence) is set with setData when it changes;
 * the live price (15s) updates ONLY the last forming bar via series.update —
 * no chart rebuild, so the user's zoom/pan and the view are preserved.
 */
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
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Build the chart when the data set or options change (~5 min cadence).
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
      priceFormat: { type: "price", precision: decimals, minMove: Math.pow(10, -decimals) },
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
    seriesRef.current = candleSeries;

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

    return () => {
      chart.remove();
      seriesRef.current = null;
    };
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
