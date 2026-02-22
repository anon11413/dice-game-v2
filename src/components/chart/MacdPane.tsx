import { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type Time,
  ColorType,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';
import { useMarketStore } from '../../store/marketStore';
import { macd } from '../../engine/aggregation/indicators';
import type { OHLCV } from '../../engine/types';

interface Props {
  resolution: number;
  visibleRange?: LogicalRange | null;
}

export function MacdPane({ resolution, visibleRange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const macdLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const signalLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const histogramRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candles = useMarketStore((s) => s.candles.get(resolution));

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0a0e17' }, textColor: '#6b7280', fontSize: 10 },
      grid: { vertLines: { color: '#1c2333' }, horzLines: { color: '#1c2333' } },
      rightPriceScale: { borderColor: '#1c2333' },
      timeScale: { visible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
      width: containerRef.current.clientWidth,
      height: 100,
    });
    chartRef.current = chart;

    histogramRef.current = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });
    macdLineRef.current = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    signalLineRef.current = chart.addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  useEffect(() => {
    if (!macdLineRef.current || !signalLineRef.current || !histogramRef.current || !candles || candles.length === 0) return;
    const macdData = macd(candles, 12, 26, 9);

    const macdLine = candles
      .map((c: OHLCV, i: number) => macdData[i].macd !== null ? { time: c.time as Time, value: macdData[i].macd! } : null)
      .filter(Boolean) as { time: Time; value: number }[];

    const signalLine = candles
      .map((c: OHLCV, i: number) => macdData[i].signal !== null ? { time: c.time as Time, value: macdData[i].signal! } : null)
      .filter(Boolean) as { time: Time; value: number }[];

    const histogram = candles
      .map((c: OHLCV, i: number) => macdData[i].histogram !== null
        ? { time: c.time as Time, value: macdData[i].histogram!, color: macdData[i].histogram! >= 0 ? '#22c55e88' : '#ef444488' }
        : null
      )
      .filter(Boolean) as { time: Time; value: number; color: string }[];

    macdLineRef.current.setData(macdLine);
    signalLineRef.current.setData(signalLine);
    histogramRef.current.setData(histogram);
  }, [candles]);

  // Sync time scale with main chart
  useEffect(() => {
    if (chartRef.current && visibleRange) {
      chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
    }
  }, [visibleRange]);

  return (
    <div className="border-t border-gray-800">
      <div className="text-[10px] text-gray-500 px-2 py-0.5">MACD (12, 26, 9)</div>
      <div ref={containerRef} className="w-full h-[70px] sm:h-[100px]" />
    </div>
  );
}
