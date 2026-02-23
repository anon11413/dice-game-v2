import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  ColorType,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { useMarketStore, EMPTY_CANDLES } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';
import { sma } from '../../../engine/aggregation/indicators';
import type { OHLCV } from '../../../engine/types';

const RES_CONFIGS = [
  { key: RESOLUTIONS.ONE_MIN, label: '1m' },
  { key: RESOLUTIONS.FIVE_MIN, label: '5m' },
  { key: RESOLUTIONS.ONE_HOUR, label: '1h' },
  { key: RESOLUTIONS.ONE_DAY, label: '1D' },
];

function determineTrend(candles: OHLCV[]): { label: string; color: string } {
  if (candles.length < 5) return { label: '-- No data', color: '#6b7280' };
  const smaVals = sma(candles, Math.min(20, Math.max(3, Math.floor(candles.length / 2))));
  const recent = smaVals.filter((v): v is number => v !== null);
  if (recent.length < 3) return { label: '-- Insufficient', color: '#6b7280' };

  const last5 = recent.slice(-5);
  let ups = 0;
  let downs = 0;
  for (let i = 1; i < last5.length; i++) {
    if (last5[i] > last5[i - 1]) ups++;
    else if (last5[i] < last5[i - 1]) downs++;
  }

  if (ups >= 3) return { label: '\u2191 Uptrend', color: '#22c55e' };
  if (downs >= 3) return { label: '\u2193 Downtrend', color: '#ef4444' };
  return { label: '\u2192 Ranging', color: '#3b82f6' };
}

function MiniChart({ resKey, label }: { resKey: number; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const candles = useMarketStore((s) => s.candles.get(resKey) ?? EMPTY_CANDLES);

  const trend = determineTrend(candles);
  const smaValues = useMemo(
    () => sma(candles, Math.min(20, Math.max(2, candles.length))),
    [candles]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0d1117' },
        textColor: '#6b7280',
        fontSize: 9,
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: false,
        visible: false,
      },
      handleScroll: false,
      handleScale: false,
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, []);

  // Update data
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove previous series cleanly via refs
    if (smaSeriesRef.current) {
      try { chart.removeSeries(smaSeriesRef.current); } catch {}
      smaSeriesRef.current = null;
    }
    if (candleSeriesRef.current) {
      try { chart.removeSeries(candleSeriesRef.current); } catch {}
      candleSeriesRef.current = null;
    }

    if (candles.length === 0) return;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // SMA overlay
    const smaData = smaValues
      .map((val, i) =>
        val !== null && i < candles.length
          ? { time: candles[i].time as Time, value: val }
          : null
      )
      .filter((d): d is { time: Time; value: number } => d !== null);

    if (smaData.length > 0) {
      const smaSeries = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      smaSeries.setData(smaData);
      smaSeriesRef.current = smaSeries;
    }

    chart.timeScale().fitContent();
  }, [candles, smaValues]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-gray-400 font-medium">{label}</span>
        <span className="text-[10px] font-medium" style={{ color: trend.color }}>
          {trend.label}
        </span>
      </div>
      <div ref={containerRef} className="w-full h-[120px] rounded border border-gray-800" />
    </div>
  );
}

export function MultiTimeframeMatrix() {
  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Multi-Timeframe Matrix</h3>
      <div className="grid grid-cols-2 gap-2">
        {RES_CONFIGS.map((rc) => (
          <MiniChart key={rc.key} resKey={rc.key} label={rc.label} />
        ))}
      </div>
    </div>
  );
}
