import { useMemo } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';
import { rsi } from '../../../engine/aggregation/indicators';
import type { OHLCV } from '../../../engine/types';

interface DivergenceAlert {
  type: 'bullish' | 'bearish' | 'volume';
  severity: 'yellow' | 'red';
  title: string;
  description: string;
  range: string; // e.g. "candle 35-48"
}

const SCAN_COUNT = 50;

function findLocalMinima(values: number[], windowSize: number = 3): number[] {
  const indices: number[] = [];
  for (let i = windowSize; i < values.length - windowSize; i++) {
    let isMin = true;
    for (let j = 1; j <= windowSize; j++) {
      if (values[i] >= values[i - j] || values[i] >= values[i + j]) {
        isMin = false;
        break;
      }
    }
    if (isMin) indices.push(i);
  }
  return indices;
}

function findLocalMaxima(values: number[], windowSize: number = 3): number[] {
  const indices: number[] = [];
  for (let i = windowSize; i < values.length - windowSize; i++) {
    let isMax = true;
    for (let j = 1; j <= windowSize; j++) {
      if (values[i] <= values[i - j] || values[i] <= values[i + j]) {
        isMax = false;
        break;
      }
    }
    if (isMax) indices.push(i);
  }
  return indices;
}

function scanDivergences(candles: OHLCV[]): DivergenceAlert[] {
  if (candles.length < 20) return [];

  const recent = candles.slice(-SCAN_COUNT);
  const alerts: DivergenceAlert[] = [];

  // Compute RSI
  const rsiValues = rsi(recent);
  const closes = recent.map((c) => c.close);
  const volumes = recent.map((c) => c.volume);

  // Valid RSI values (filter nulls)
  const rsiValid = rsiValues.map((v) => v ?? 50); // fallback for null

  // Find local lows for bullish divergence detection
  const priceLows = findLocalMinima(closes, 2);
  if (priceLows.length >= 2) {
    const lastTwo = priceLows.slice(-2);
    const [i1, i2] = lastTwo;

    // Bullish divergence: price lower lows, RSI higher lows
    if (closes[i2] < closes[i1] && rsiValid[i2] > rsiValid[i1]) {
      const rsiDiff = rsiValid[i2] - rsiValid[i1];
      alerts.push({
        type: 'bullish',
        severity: rsiDiff > 10 ? 'red' : 'yellow',
        title: 'Bullish RSI Divergence',
        description: `Price made lower low ($${closes[i2].toFixed(2)} < $${closes[i1].toFixed(2)}) but RSI made higher low (${rsiValid[i2].toFixed(1)} > ${rsiValid[i1].toFixed(1)})`,
        range: `candle ${candles.length - SCAN_COUNT + i1} - ${candles.length - SCAN_COUNT + i2}`,
      });
    }
  }

  // Find local highs for bearish divergence detection
  const priceHighs = findLocalMaxima(closes, 2);
  if (priceHighs.length >= 2) {
    const lastTwo = priceHighs.slice(-2);
    const [i1, i2] = lastTwo;

    // Bearish divergence: price higher highs, RSI lower highs
    if (closes[i2] > closes[i1] && rsiValid[i2] < rsiValid[i1]) {
      const rsiDiff = rsiValid[i1] - rsiValid[i2];
      alerts.push({
        type: 'bearish',
        severity: rsiDiff > 10 ? 'red' : 'yellow',
        title: 'Bearish RSI Divergence',
        description: `Price made higher high ($${closes[i2].toFixed(2)} > $${closes[i1].toFixed(2)}) but RSI made lower high (${rsiValid[i2].toFixed(1)} < ${rsiValid[i1].toFixed(1)})`,
        range: `candle ${candles.length - SCAN_COUNT + i1} - ${candles.length - SCAN_COUNT + i2}`,
      });
    }
  }

  // Volume divergence: price trending but volume declining
  // Check last 20 candles
  if (recent.length >= 20) {
    const last20 = recent.slice(-20);
    const priceSlope = (last20[last20.length - 1].close - last20[0].close) / last20.length;
    const volFirst10 = last20.slice(0, 10).reduce((s, c) => s + c.volume, 0) / 10;
    const volLast10 = last20.slice(10).reduce((s, c) => s + c.volume, 0) / 10;

    const isPriceTrending = Math.abs(priceSlope) > 0.01;
    const isVolumeDeclining = volLast10 < volFirst10 * 0.7;

    if (isPriceTrending && isVolumeDeclining) {
      const direction = priceSlope > 0 ? 'upward' : 'downward';
      const volDrop = ((1 - volLast10 / volFirst10) * 100).toFixed(0);
      alerts.push({
        type: 'volume',
        severity: volLast10 < volFirst10 * 0.5 ? 'red' : 'yellow',
        title: 'Volume Divergence',
        description: `Price trending ${direction} but volume declined ${volDrop}% (avg ${volFirst10.toFixed(0)} -> ${volLast10.toFixed(0)})`,
        range: `last 20 candles`,
      });
    }
  }

  return alerts;
}

function AlertCard({ alert }: { alert: DivergenceAlert }) {
  const borderColor = alert.severity === 'red' ? 'border-red-500/50' : 'border-yellow-500/50';
  const bgColor = alert.severity === 'red' ? 'bg-red-500/5' : 'bg-yellow-500/5';
  const iconColor = alert.severity === 'red' ? 'text-red-400' : 'text-yellow-400';
  const badgeColor =
    alert.type === 'bullish'
      ? 'bg-green-500/20 text-green-400'
      : alert.type === 'bearish'
        ? 'bg-red-500/20 text-red-400'
        : 'bg-blue-500/20 text-blue-400';

  const icon = alert.severity === 'red' ? '\u26a0' : '\u25cb';

  return (
    <div className={`rounded-md p-2.5 border ${borderColor} ${bgColor}`}>
      <div className="flex items-start gap-2">
        <span className={`text-base ${iconColor} mt-0.5`}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-200">{alert.title}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${badgeColor}`}>
              {alert.type}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">{alert.description}</p>
          <span className="text-[9px] text-gray-500 mt-1 block">{alert.range}</span>
        </div>
      </div>
    </div>
  );
}

export function DivergenceScanner() {
  const candles = useMarketStore((s) => s.candles.get(RESOLUTIONS.TICK) ?? []);
  const alerts = useMemo(() => scanDivergences(candles), [candles]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Divergence Scanner</h3>
        {alerts.length > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-xs">
            No divergences detected in the last {SCAN_COUNT} candles
          </div>
        ) : (
          alerts.map((alert, i) => <AlertCard key={i} alert={alert} />)
        )}
      </div>
    </div>
  );
}
