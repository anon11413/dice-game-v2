import { useRef, useEffect, useCallback, useState } from 'react';
import { useDiceStore } from '../../../store/diceStore';
import { useMarketStore } from '../../../store/marketStore';
import { useAnalysisStore } from '../../../store/analysisStore';
import { RESOLUTIONS } from '../../../engine/constants';

export function FundamentalEstimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 160 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const fEstRef = useRef(100.0);
  const fHistoryRef = useRef<number[]>([100.0]);
  const priceHistoryRef = useRef<number[]>([100.0]);
  const tickCountRef = useRef(0);

  const bandMeans = useDiceStore((s) => s.bandMeans);
  const price = useMarketStore((s) => s.price);
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const revealData = useAnalysisStore((s) => s.revealData);
  const revealHistory = useAnalysisStore((s) => s.revealHistory);

  // Update F_t estimation on each tick
  useEffect(() => {
    tickCountRef.current++;

    // F_t drift happens every 65 ticks (DAILY)
    if (tickCountRef.current % RESOLUTIONS.DAILY === 0) {
      const f = bandMeans[3]; // band4 mean (index 3)
      const F_prev = fEstRef.current;
      let drift = 0;
      if (f > 12) drift = 1;
      else if (f < 9) drift = -1;

      const magnitude = 0.002 * Math.abs(f - 10.5) / 9.5 * F_prev;
      fEstRef.current = F_prev + drift * magnitude;
    }

    // Accumulate histories
    const fHist = fHistoryRef.current;
    const pHist = priceHistoryRef.current;
    fHist.push(fEstRef.current);
    pHist.push(price);
    if (fHist.length > 200) fHist.shift();
    if (pHist.length > 200) pHist.shift();

    dirtyRef.current = true;
  }, [bandMeans, price]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(140, Math.floor(w * 0.5)) });
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

    const fHist = fHistoryRef.current;
    const pHist = priceHistoryRef.current;
    if (fHist.length < 2 || pHist.length < 2) return;

    const pad = { top: 8, right: 8, bottom: 16, left: 40 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Compute Y range
    const allVals = [...fHist, ...pHist];
    let minY = Math.min(...allVals);
    let maxY = Math.max(...allVals);

    if (revealEnabled && revealHistory.length > 0) {
      for (const rh of revealHistory) {
        minY = Math.min(minY, rh.F_t);
        maxY = Math.max(maxY, rh.F_t);
      }
    }

    const range = maxY - minY || 1;
    minY -= range * 0.05;
    maxY += range * 0.05;
    const yRange = maxY - minY;

    const toX = (i: number, len: number) => pad.left + (i / (len - 1)) * plotW;
    const toY = (v: number) => pad.top + (1 - (v - minY) / yRange) * plotH;

    // Shade gap between price and F_t
    const len = Math.min(fHist.length, pHist.length);
    for (let i = 0; i < len - 1; i++) {
      const x0 = toX(i, len);
      const x1 = toX(i + 1, len);
      const fp0 = toY(fHist[i]);
      const fp1 = toY(fHist[i + 1]);
      const pp0 = toY(pHist[i]);
      const pp1 = toY(pHist[i + 1]);

      ctx.beginPath();
      ctx.moveTo(x0, fp0);
      ctx.lineTo(x1, fp1);
      ctx.lineTo(x1, pp1);
      ctx.lineTo(x0, pp0);
      ctx.closePath();

      const priceAbove = pHist[i] > fHist[i];
      ctx.fillStyle = priceAbove ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)';
      ctx.fill();
    }

    // Price line (white solid)
    ctx.beginPath();
    for (let i = 0; i < pHist.length; i++) {
      const x = toX(i, pHist.length);
      const y = toY(pHist[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Estimated F_t line (blue dashed)
    ctx.beginPath();
    for (let i = 0; i < fHist.length; i++) {
      const x = toX(i, fHist.length);
      const y = toY(fHist[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reveal: actual F_t (purple line)
    if (revealEnabled && revealHistory.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < revealHistory.length; i++) {
        const x = toX(i, revealHistory.length);
        const y = toY(revealHistory[i].F_t);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Y axis labels
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = minY + (i / steps) * yRange;
      const y = toY(val);
      ctx.fillText(val.toFixed(1), pad.left - 4, y);
    }

    // Legend
    const legendY = pad.top + 4;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(pad.left + 4, legendY, 12, 2);
    ctx.fillText('Price', pad.left + 20, legendY + 3);

    ctx.fillStyle = '#3b82f6';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left + 4, legendY + 14);
    ctx.lineTo(pad.left + 16, legendY + 14);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('Est. F_t', pad.left + 20, legendY + 17);

    if (revealEnabled) {
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(pad.left + 4, legendY + 26, 12, 2);
      ctx.fillText('Actual F_t', pad.left + 20, legendY + 29);
    }
  }, [dims, revealEnabled, revealHistory]);

  // Gap calculation
  const currentGap = price !== 0 ? ((price - fEstRef.current) / fEstRef.current) * 100 : 0;
  const gapColor = currentGap > 0 ? '#ef4444' : '#22c55e';
  const gapLabel = currentGap > 0 ? 'Overvalued' : 'Undervalued';

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
  }, [bandMeans, price, revealHistory]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-300">Fundamental Value (F_t)</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: gapColor }}>
            {gapLabel}: {Math.abs(currentGap).toFixed(2)}%
          </span>
          {revealEnabled && revealData && (
            <span className="text-xs text-purple-400">
              Real: ${revealData.F_t.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-lg font-bold text-blue-400">
          Est: ${fEstRef.current.toFixed(2)}
        </span>
        <span className="text-sm text-gray-400">
          Price: ${price.toFixed(2)}
        </span>
      </div>

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
