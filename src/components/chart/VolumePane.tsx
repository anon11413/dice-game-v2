import { useEffect, useRef } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LogicalRange,
  type Time,
  ColorType,
  HistogramSeries,
} from 'lightweight-charts';
import { useMarketStore } from '../../store/marketStore';
import type { OHLCV } from '../../engine/types';

interface Props {
  resolution: number;
  visibleRange?: LogicalRange | null;
}

export function VolumePane({ resolution, visibleRange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
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
      height: 80,
    });
    chartRef.current = chart;

    seriesRef.current = chart.addSeries(HistogramSeries, {
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
    if (!seriesRef.current || !candles) return;
    seriesRef.current.setData(
      candles.map((c: OHLCV) => ({
        time: c.time as Time,
        value: c.volume,
        color: c.close >= c.open ? '#22c55e55' : '#ef444455',
      }))
    );
  }, [candles]);

  // Sync time scale with main chart
  useEffect(() => {
    if (chartRef.current && visibleRange) {
      chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
    }
  }, [visibleRange]);

  return (
    <div className="border-t border-gray-800">
      <div className="text-[10px] text-gray-500 px-2 py-0.5">Volume</div>
      <div ref={containerRef} className="w-full h-[80px]" />
    </div>
  );
}
