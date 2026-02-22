import { useRef, useEffect, useCallback, useState } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';

const NUM_BINS = 30;

function computeStats(returns: number[]): { mean: number; std: number; skewness: number; kurtosis: number } {
  if (returns.length < 2) return { mean: 0, std: 0, skewness: 0, kurtosis: 0 };

  const n = returns.length;
  const mean = returns.reduce((s, v) => s + v, 0) / n;
  const diffs = returns.map((v) => v - mean);
  const variance = diffs.reduce((s, d) => s + d * d, 0) / n;
  const std = Math.sqrt(variance);

  if (std === 0) return { mean, std: 0, skewness: 0, kurtosis: 0 };

  const m3 = diffs.reduce((s, d) => s + d * d * d, 0) / n;
  const skewness = m3 / (std * std * std);

  const m4 = diffs.reduce((s, d) => s + d * d * d * d, 0) / n;
  const kurtosis = m4 / (variance * variance) - 3; // excess kurtosis

  return { mean, std, skewness, kurtosis };
}

function normalPDF(x: number, mean: number, std: number): number {
  if (std === 0) return 0;
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
}

export function ReturnDistribution() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 200 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const candles = useMarketStore((s) => s.candles);
  const tickCandles = candles.get(RESOLUTIONS.TICK);

  // Compute returns from last 500 tick candles
  const returns = useRef<number[]>([]);
  useEffect(() => {
    if (!tickCandles || tickCandles.length < 2) {
      returns.current = [];
      return;
    }
    const start = Math.max(0, tickCandles.length - 500);
    const slice = tickCandles.slice(start);
    const ret: number[] = [];
    for (let i = 1; i < slice.length; i++) {
      const prev = slice[i - 1].close;
      if (prev > 0) {
        ret.push((slice[i].close - prev) / prev * 100);
      }
    }
    returns.current = ret;
    dirtyRef.current = true;
  }, [tickCandles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(160, Math.floor(w * 0.35)) });
        dirtyRef.current = true;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const stats = computeStats(returns.current);

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

    const data = returns.current;
    if (data.length < 5) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Collecting return data...', w / 2, h / 2);
      return;
    }

    const pad = { top: 10, right: 10, bottom: 24, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Compute histogram bins
    const minR = Math.min(...data);
    const maxR = Math.max(...data);
    const range = maxR - minR || 1;
    const binW = range / NUM_BINS;

    const bins = new Array(NUM_BINS).fill(0);
    for (const r of data) {
      const bin = Math.min(NUM_BINS - 1, Math.floor((r - minR) / binW));
      bins[bin]++;
    }

    const maxBin = Math.max(...bins);
    if (maxBin === 0) return;

    const barW = plotW / NUM_BINS;

    // Draw histogram bars
    for (let i = 0; i < NUM_BINS; i++) {
      const barH = (bins[i] / maxBin) * plotH;
      const x = pad.left + i * barW;
      const y = pad.top + plotH - barH;

      ctx.fillStyle = 'rgba(59,130,246,0.6)';
      ctx.fillRect(x + 0.5, y, barW - 1, barH);
      ctx.strokeStyle = 'rgba(59,130,246,0.8)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y, barW - 1, barH);
    }

    // Overlay normal distribution curve
    if (stats.std > 0) {
      // Scale: peak of normal at mean should roughly match the tallest bin
      const normalPeak = normalPDF(stats.mean, stats.mean, stats.std);
      const scaleFactor = (maxBin / normalPeak) * (1 / (data.length * binW));

      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const returnVal = minR + (px / plotW) * range;
        const density = normalPDF(returnVal, stats.mean, stats.std);
        const barH = density * scaleFactor * data.length * binW / maxBin * plotH;
        const x = pad.left + px;
        const y = pad.top + plotH - barH;
        if (px === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Zero line
    if (minR < 0 && maxR > 0) {
      const zeroX = pad.left + ((0 - minR) / range) * plotW;
      ctx.beginPath();
      ctx.moveTo(zeroX, pad.top);
      ctx.lineTo(zeroX, pad.top + plotH);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // X axis labels
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const val = minR + (i / 4) * range;
      const x = pad.left + (i / 4) * plotW;
      ctx.fillText(val.toFixed(2) + '%', x, pad.top + plotH + 4);
    }

    // Y axis labels
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 3; i++) {
      const val = Math.round((i / 3) * maxBin);
      const y = pad.top + plotH - (i / 3) * plotH;
      ctx.fillText(val.toString(), pad.left - 4, y);
    }
  }, [dims, stats]);

  useEffect(() => {
    dirtyRef.current = true;
    const tick = () => {
      if (dirtyRef.current) {
        draw();
        dirtyRef.current = false;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [tickCandles]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Return Distribution</h3>

      {/* Stats row */}
      <div className="flex flex-wrap gap-3 mb-2 text-[10px]">
        <div>
          <span className="text-gray-500">Mean: </span>
          <span className="text-gray-300 font-mono">{stats.mean.toFixed(4)}%</span>
        </div>
        <div>
          <span className="text-gray-500">Std: </span>
          <span className="text-gray-300 font-mono">{stats.std.toFixed(4)}%</span>
        </div>
        <div>
          <span className="text-gray-500">Skew: </span>
          <span className={`font-mono ${stats.skewness > 0 ? 'text-green-400' : stats.skewness < 0 ? 'text-red-400' : 'text-gray-300'}`}>
            {stats.skewness.toFixed(3)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Kurt: </span>
          <span className={`font-mono ${stats.kurtosis > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
            {stats.kurtosis.toFixed(3)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">N: </span>
          <span className="text-gray-300 font-mono">{returns.current.length}</span>
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
