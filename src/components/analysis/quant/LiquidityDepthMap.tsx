import { useRef, useEffect, useCallback, useState } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { useAnalysisStore } from '../../../store/analysisStore';
import type { BookSnapshot } from '../../../engine/types';

interface DepthSnapshot {
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  bestBid: number | null;
  bestAsk: number | null;
}

const MAX_SNAPSHOTS = 50;

export function LiquidityDepthMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 200 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const historyRef = useRef<DepthSnapshot[]>([]);

  const bookSnapshot = useMarketStore((s) => s.bookSnapshot);
  const depthBySource = useAnalysisStore((s) => s.depthBySource);

  // Accumulate book snapshots
  useEffect(() => {
    if (!bookSnapshot) return;
    const snap: DepthSnapshot = {
      bids: bookSnapshot.bids.map((b) => ({ price: b.price, size: b.totalSize })),
      asks: bookSnapshot.asks.map((a) => ({ price: a.price, size: a.totalSize })),
      bestBid: bookSnapshot.bestBid,
      bestAsk: bookSnapshot.bestAsk,
    };
    const hist = historyRef.current;
    hist.push(snap);
    if (hist.length > MAX_SNAPSHOTS) hist.shift();
    dirtyRef.current = true;
  }, [bookSnapshot]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(180, Math.floor(w * 0.55)) });
        dirtyRef.current = true;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dims.w;
    const h = dims.h;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const history = historyRef.current;
    if (history.length === 0) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting order book data...', w / 2, h / 2);
      return;
    }

    const pad = { top: 8, right: 8, bottom: 20, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Collect all price levels and find range
    let allPrices: number[] = [];
    let maxSize = 0;
    for (const snap of history) {
      for (const b of snap.bids) {
        allPrices.push(b.price);
        maxSize = Math.max(maxSize, b.size);
      }
      for (const a of snap.asks) {
        allPrices.push(a.price);
        maxSize = Math.max(maxSize, a.size);
      }
    }

    if (allPrices.length === 0) return;

    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    const numSnaps = history.length;
    const colW = plotW / Math.max(numSnaps, 1);

    // Determine price level buckets (about 30 levels)
    const numLevels = 30;
    const levelSize = priceRange / numLevels;

    // Draw heatmap
    for (let si = 0; si < numSnaps; si++) {
      const snap = history[si];
      const x = pad.left + si * colW;

      // Aggregate sizes into price buckets
      const buckets: { bidSize: number; askSize: number }[] = Array.from(
        { length: numLevels + 1 },
        () => ({ bidSize: 0, askSize: 0 })
      );

      for (const b of snap.bids) {
        const bucket = Math.floor((b.price - minPrice) / levelSize);
        const idx = Math.max(0, Math.min(numLevels, bucket));
        buckets[idx].bidSize += b.size;
      }
      for (const a of snap.asks) {
        const bucket = Math.floor((a.price - minPrice) / levelSize);
        const idx = Math.max(0, Math.min(numLevels, bucket));
        buckets[idx].askSize += a.size;
      }

      const cellH = plotH / (numLevels + 1);

      for (let li = 0; li <= numLevels; li++) {
        const y = pad.top + (numLevels - li) * cellH;
        const bucket = buckets[li];
        const bidIntensity = maxSize > 0 ? Math.min(1, bucket.bidSize / (maxSize * 0.3)) : 0;
        const askIntensity = maxSize > 0 ? Math.min(1, bucket.askSize / (maxSize * 0.3)) : 0;

        if (bidIntensity > 0) {
          ctx.fillStyle = `rgba(34,197,94,${0.1 + bidIntensity * 0.8})`;
          ctx.fillRect(x, y, colW, cellH);
        }
        if (askIntensity > 0) {
          ctx.fillStyle = `rgba(239,68,68,${0.1 + askIntensity * 0.8})`;
          ctx.fillRect(x, y, colW, cellH);
        }
      }

      // Best bid/ask lines
      if (snap.bestBid !== null) {
        const by = pad.top + (1 - (snap.bestBid - minPrice) / priceRange) * plotH;
        ctx.fillStyle = 'rgba(34,197,94,0.7)';
        ctx.fillRect(x, by - 0.5, colW, 1);
      }
      if (snap.bestAsk !== null) {
        const ay = pad.top + (1 - (snap.bestAsk - minPrice) / priceRange) * plotH;
        ctx.fillStyle = 'rgba(239,68,68,0.7)';
        ctx.fillRect(x, ay - 0.5, colW, 1);
      }
    }

    // Y axis labels
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const val = minPrice + (i / 4) * priceRange;
      const y = pad.top + (1 - i / 4) * plotH;
      ctx.fillText(val.toFixed(2), pad.left - 3, y);
    }

    // X axis label
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Time (last ${numSnaps} snapshots)`, w / 2, h - 10);

    // Legend
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(pad.left + 2, pad.top + 2, 8, 3);
    ctx.fillText('Bids', pad.left + 14, pad.top + 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(pad.left + 2, pad.top + 10, 8, 3);
    ctx.fillText('Asks', pad.left + 14, pad.top + 12);
  }, [dims]);

  const drawSourceBars = useCallback(() => {
    const canvas = barCanvasRef.current;
    if (!canvas || !depthBySource) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dims.w;
    const h = 60;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const sources = Object.entries(depthBySource);
    if (sources.length === 0) return;

    const sourceColors: Record<string, string> = {
      MM: '#3b82f6',
      SCALP: '#06b6d4',
      SWING: '#22c55e',
      POS: '#eab308',
      VALUE: '#a855f7',
      SHORT: '#ef4444',
      SQUEEZE: '#f97316',
    };

    const pad = { left: 40, right: 10, top: 4, bottom: 4 };
    const barH = Math.min(6, (h - pad.top - pad.bottom) / sources.length - 2);
    let maxVal = 0;
    for (const [, d] of sources) {
      maxVal = Math.max(maxVal, d.bidSize, d.askSize);
    }
    if (maxVal === 0) maxVal = 1;

    const barAreaW = (w - pad.left - pad.right) / 2 - 4;

    sources.forEach(([source, d], i) => {
      const y = pad.top + i * (barH + 3);
      const color = sourceColors[source] || '#6b7280';

      // Label
      ctx.font = '8px sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(source, pad.left - 4, y + barH / 2);

      // Bid bar (left half)
      const bidW = (d.bidSize / maxVal) * barAreaW;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(pad.left, y, bidW, barH);
      ctx.globalAlpha = 1;

      // Ask bar (right half)
      const askW = (d.askSize / maxVal) * barAreaW;
      const askX = pad.left + barAreaW + 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(askX, y, askW, barH);
      ctx.globalAlpha = 1;
    });

    // Column headers
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.fillText('Bid Depth', pad.left + barAreaW / 2, h - 2);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Ask Depth', pad.left + barAreaW + 8 + barAreaW / 2, h - 2);
  }, [dims, depthBySource]);

  useEffect(() => {
    dirtyRef.current = true;
    const tick = () => {
      if (dirtyRef.current) {
        draw();
        drawSourceBars();
        dirtyRef.current = false;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, drawSourceBars]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [bookSnapshot, depthBySource]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Liquidity Depth Map</h3>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Depth by source bar chart */}
      <div className="mt-2">
        <span className="text-[10px] text-gray-500">Depth by Order Source</span>
        <canvas ref={barCanvasRef} className="w-full" style={{ height: 60 }} />
      </div>
    </div>
  );
}
