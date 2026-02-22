import { useEffect, useRef, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { useMarketStore } from '../../store/marketStore';
import { useIndicatorStore } from '../../store/indicatorStore';
import { useSimulation } from '../../bridge/useSimulation';
import type { OHLCV } from '../../engine/types';
import { sma, ema, bollingerBands, vwap as calcVwap } from '../../engine/aggregation/indicators';

interface Props {
  resolution: number;
  mode: 'candle' | 'line';
}

function ohlcvToCandle(c: OHLCV): CandlestickData<Time> {
  return {
    time: c.time as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function ohlcvToLine(c: OHLCV): LineData<Time> {
  return { time: c.time as Time, value: c.close };
}

export function PriceChart({ resolution, mode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | null>(null);
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const { requestCandles } = useSimulation();
  const indicators = useIndicatorStore((s) => s.enabled);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0e17' },
        textColor: '#6b7280',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1c2333' },
        horzLines: { color: '#1c2333' },
      },
      crosshair: {
        vertLine: { color: '#4b5563', width: 1, style: 2 },
        horzLine: { color: '#4b5563', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#1c2333',
      },
      timeScale: {
        borderColor: '#1c2333',
        timeVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });

    chartRef.current = chart;

    // Resize observer
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
      mainSeriesRef.current = null;
      overlaySeriesRef.current.clear();
    };
  }, []);

  // Update series type when mode changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old series
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
    }

    // Remove overlays
    for (const [, series] of overlaySeriesRef.current) {
      chart.removeSeries(series);
    }
    overlaySeriesRef.current.clear();

    // Create new main series
    if (mode === 'candle') {
      mainSeriesRef.current = chart.addSeries(CandlestickSeries, {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        wickUpColor: '#22c55e',
      });
    } else {
      mainSeriesRef.current = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
      });
    }

  }, [mode]);

  // Request candles on resolution change
  useEffect(() => {
    requestCandles(resolution);
  }, [resolution, requestCandles]);

  // Subscribe to candle data and update chart
  const candles = useMarketStore((s) => s.candles.get(resolution));
  const price = useMarketStore((s) => s.price);

  const updateChart = useCallback(() => {
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!chart || !series || !candles || candles.length === 0) return;

    if (mode === 'candle') {
      (series as ISeriesApi<'Candlestick'>).setData(candles.map(ohlcvToCandle));
    } else {
      (series as ISeriesApi<'Line'>).setData(candles.map(ohlcvToLine));
    }

    // Update overlay indicators
    updateOverlays(chart, candles);
  }, [candles, mode, indicators]);

  const updateOverlays = (chart: IChartApi, data: OHLCV[]) => {
    // Remove old overlays
    for (const [key, series] of overlaySeriesRef.current) {
      if (!shouldShowOverlay(key)) {
        chart.removeSeries(series);
        overlaySeriesRef.current.delete(key);
      }
    }

    // SMA overlays
    if (indicators.sma20) addOrUpdateLineSeries(chart, 'sma20', data, sma(data, 20), '#f59e0b');
    if (indicators.sma50) addOrUpdateLineSeries(chart, 'sma50', data, sma(data, 50), '#8b5cf6');
    if (indicators.sma200) addOrUpdateLineSeries(chart, 'sma200', data, sma(data, 200), '#ec4899');
    if (indicators.ema20) addOrUpdateLineSeries(chart, 'ema20', data, ema(data, 20), '#06b6d4');

    // Bollinger Bands
    if (indicators.bollingerBands) {
      const bb = bollingerBands(data, 20, 2.0);
      const upper = bb.map(b => b.upper);
      const lower = bb.map(b => b.lower);
      addOrUpdateLineSeries(chart, 'bb_upper', data, upper, '#6366f1', 1);
      addOrUpdateLineSeries(chart, 'bb_lower', data, lower, '#6366f1', 1);
    }

    // VWAP
    if (indicators.vwap) {
      const vwapData = calcVwap(data, 390);
      addOrUpdateLineSeries(chart, 'vwap', data, vwapData.map(v => v as number | null), '#f97316', 1);
    }
  };

  const shouldShowOverlay = (key: string): boolean => {
    if (key === 'sma20') return indicators.sma20;
    if (key === 'sma50') return indicators.sma50;
    if (key === 'sma200') return indicators.sma200;
    if (key === 'ema20') return indicators.ema20;
    if (key.startsWith('bb_')) return indicators.bollingerBands;
    if (key === 'vwap') return indicators.vwap;
    return false;
  };

  const addOrUpdateLineSeries = (
    chart: IChartApi,
    key: string,
    candles: OHLCV[],
    values: (number | null)[],
    color: string,
    lineWidth: number = 1
  ) => {
    let series = overlaySeriesRef.current.get(key);
    if (!series) {
      series = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      overlaySeriesRef.current.set(key, series);
    }

    const lineData: LineData<Time>[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (values[i] !== null && values[i] !== undefined) {
        lineData.push({ time: candles[i].time as Time, value: values[i]! });
      }
    }
    series.setData(lineData);
  };

  // Run update when candles or indicators change
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  // Request candles periodically for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      requestCandles(resolution);
    }, 500);
    return () => clearInterval(interval);
  }, [resolution, requestCandles]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[300px]" />
  );
}
