import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';
import type { OHLCV } from '../../../engine/types';

/** Detect local min/max from candle history and group nearby prices */
function detectSRLevels(candles: OHLCV[], tolerance: number = 0.005): number[] {
  if (candles.length < 5) return [];

  const pivots: number[] = [];

  // Scan for local minima and maxima (using a 2-bar lookback/forward)
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high;
    const l = candles[i].low;

    // Local high
    if (
      h >= candles[i - 1].high &&
      h >= candles[i - 2].high &&
      h >= candles[i + 1].high &&
      h >= candles[i + 2].high
    ) {
      pivots.push(h);
    }

    // Local low
    if (
      l <= candles[i - 1].low &&
      l <= candles[i - 2].low &&
      l <= candles[i + 1].low &&
      l <= candles[i + 2].low
    ) {
      pivots.push(l);
    }
  }

  if (pivots.length === 0) return [];

  // Cluster nearby pivots within tolerance
  const sorted = [...pivots].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const lastCluster = clusters[clusters.length - 1];
    const clusterAvg = lastCluster.reduce((a, b) => a + b, 0) / lastCluster.length;

    if (Math.abs(sorted[i] - clusterAvg) / clusterAvg <= tolerance) {
      lastCluster.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  // Return cluster averages, weighted by touch count (more touches = stronger level)
  // Only keep clusters with 2+ touches
  return clusters
    .filter((c) => c.length >= 2)
    .map((c) => c.reduce((a, b) => a + b, 0) / c.length);
}

export function SupportResistanceMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const bookSnapshot = useMarketStore((s) => s.bookSnapshot);
  const candles = useMarketStore((s) => s.candles.get(RESOLUTIONS.TICK) ?? []);
  const currentPrice = useMarketStore((s) => s.price);

  const srLevels = useMemo(() => detectSRLevels(candles), [candles]);

  const prevRef = useRef({ bookSnapshot, srLevels, currentPrice });
  if (
    prevRef.current.bookSnapshot !== bookSnapshot ||
    prevRef.current.srLevels !== srLevels ||
    prevRef.current.currentPrice !== currentPrice
  ) {
    dirtyRef.current = true;
    prevRef.current = { bookSnapshot, srLevels, currentPrice };
  }

  const draw = useCallback(() => {
    if (!dirtyRef.current) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }
    dirtyRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (!bookSnapshot || (bookSnapshot.bids.length === 0 && bookSnapshot.asks.length === 0)) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for order book data...', W / 2, H / 2);
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    const { bids, asks } = bookSnapshot;

    // Price range from book
    const allPrices = [
      ...bids.map((b) => b.price),
      ...asks.map((a) => a.price),
      currentPrice,
      ...srLevels,
    ];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = Math.max(maxPrice - minPrice, 0.01);

    const margin = 6;
    const axisW = 50; // right price axis width
    const chartW = W - axisW;
    const midX = chartW / 2;

    const toY = (price: number) =>
      margin + (1 - (price - minPrice) / priceRange) * (H - margin * 2);

    // Max depth for scaling bars
    const maxDepth = Math.max(
      ...bids.map((b) => b.totalSize),
      ...asks.map((a) => a.totalSize),
      1
    );
    const maxBarW = midX - 8;

    // Draw bid depth bars (green, extending left from center)
    for (const bid of bids) {
      const y = toY(bid.price);
      const barW = (bid.totalSize / maxDepth) * maxBarW;
      const barH = Math.max(2, (H - margin * 2) / Math.max(bids.length + asks.length, 1) - 1);

      ctx.fillStyle = '#22c55e40';
      ctx.fillRect(midX - barW, y - barH / 2, barW, barH);
      ctx.strokeStyle = '#22c55e80';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(midX - barW, y - barH / 2, barW, barH);
    }

    // Draw ask depth bars (red, extending right from center)
    for (const ask of asks) {
      const y = toY(ask.price);
      const barW = (ask.totalSize / maxDepth) * maxBarW;
      const barH = Math.max(2, (H - margin * 2) / Math.max(bids.length + asks.length, 1) - 1);

      ctx.fillStyle = '#ef444440';
      ctx.fillRect(midX, y - barH / 2, barW, barH);
      ctx.strokeStyle = '#ef444480';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(midX, y - barH / 2, barW, barH);
    }

    // Center line
    ctx.strokeStyle = '#ffffff15';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, margin);
    ctx.lineTo(midX, H - margin);
    ctx.stroke();

    // Current price line
    const priceY = toY(currentPrice);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(0, priceY);
    ctx.lineTo(chartW, priceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // S/R level dotted lines
    for (const level of srLevels) {
      const y = toY(level);
      const isSupport = level < currentPrice;

      ctx.strokeStyle = isSupport ? '#22c55e60' : '#ef444460';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // S/R label
      ctx.fillStyle = isSupport ? '#22c55e' : '#ef4444';
      ctx.font = '8px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(isSupport ? 'S' : 'R', 3, y - 2);
    }

    // Right price axis
    ctx.fillStyle = '#111827';
    ctx.fillRect(chartW, 0, axisW, H);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartW, 0);
    ctx.lineTo(chartW, H);
    ctx.stroke();

    // Price axis labels
    const tickCount = 6;
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i <= tickCount; i++) {
      const price = minPrice + (priceRange * i) / tickCount;
      const y = toY(price);
      ctx.fillText(price.toFixed(2), chartW + 4, y + 3);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(chartW, y);
      ctx.lineTo(chartW + 3, y);
      ctx.stroke();
    }

    // Current price on axis
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(currentPrice.toFixed(2), chartW + 4, priceY + 3);

    // Labels
    ctx.fillStyle = '#22c55e80';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Bids', midX / 2, H - 2);
    ctx.fillStyle = '#ef444480';
    ctx.fillText('Asks', midX + midX / 2, H - 2);

    animRef.current = requestAnimationFrame(draw);
  }, [bookSnapshot, srLevels, currentPrice]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Support / Resistance Map</h3>
        {srLevels.length > 0 && (
          <span className="text-[10px] text-gray-500">{srLevels.length} levels detected</span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={220}
        className="w-full rounded border border-gray-800"
      />
    </div>
  );
}
