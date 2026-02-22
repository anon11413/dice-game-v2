import { useRef, useEffect, useCallback, useState } from 'react';
import { useDiceStore } from '../../../store/diceStore';
import { useAnalysisStore } from '../../../store/analysisStore';

/** Piecewise kappa estimation from band7 (index 6) mean and std */
function estimateKappaRaw(mean: number, std: number): number {
  let raw: number;
  if (mean <= 5) raw = 0.3;
  else if (mean <= 8) raw = 0.3 + (mean - 5) * (0.7 / 3);
  else if (mean <= 13) raw = 1.0;
  else if (mean <= 17) raw = 1.0 + (mean - 13) * (1.5 / 4);
  else raw = 2.5 + (mean - 17) * (1.5 / 3);

  if (std > 7) raw *= 1 + (std - 7) * 0.15;
  return raw;
}

function getKappaLabel(kappa: number): { text: string; color: string } {
  if (kappa < 0.5) return { text: 'LOW', color: '#22c55e' };
  if (kappa < 1.5) return { text: 'NORMAL', color: '#3b82f6' };
  if (kappa < 2.5) return { text: 'ELEVATED', color: '#eab308' };
  if (kappa < 3.5) return { text: 'HIGH', color: '#f97316' };
  return { text: 'EXTREME', color: '#ef4444' };
}

export function KappaEstimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 120 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const smoothedRef = useRef(1.0);
  const historyRef = useRef<number[]>([]);

  const bandMeans = useDiceStore((s) => s.bandMeans);
  const bandStds = useDiceStore((s) => s.bandStds);
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const revealData = useAnalysisStore((s) => s.revealData);
  const revealHistory = useAnalysisStore((s) => s.revealHistory);

  // Update smoothed kappa
  const rawKappa = estimateKappaRaw(bandMeans[6], bandStds[6]);
  const smoothed = 0.7 * smoothedRef.current + 0.3 * rawKappa;
  const clamped = Math.max(0.2, Math.min(5.0, smoothed));
  smoothedRef.current = clamped;

  // Accumulate history
  useEffect(() => {
    const hist = historyRef.current;
    hist.push(clamped);
    if (hist.length > 200) hist.shift();
    dirtyRef.current = true;
  }, [clamped]);

  const label = getKappaLabel(clamped);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(100, Math.floor(w * 0.4)) });
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

    const data = historyRef.current;
    if (data.length < 2) return;

    const pad = { top: 8, right: 8, bottom: 16, left: 30 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const maxY = 5.0;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (const yVal of [1, 2, 3, 4]) {
      const y = pad.top + (1 - yVal / maxY) * plotH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(yVal.toString(), pad.left - 4, y);
    }

    // Estimated kappa line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad.left + (i / (data.length - 1)) * plotW;
      const y = pad.top + (1 - Math.min(data[i], maxY) / maxY) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill below estimated
    const lastX = pad.left + plotW;
    ctx.lineTo(lastX, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(59,130,246,0.08)';
    ctx.fill();

    // Reveal: actual kappa history
    if (revealEnabled && revealHistory.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < revealHistory.length; i++) {
        const x = pad.left + (i / (revealHistory.length - 1)) * plotW;
        const y = pad.top + (1 - Math.min(revealHistory[i].kappa_t, maxY) / maxY) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Threshold zones
    const zones = [
      { y: 0.5, color: 'rgba(34,197,94,0.15)' },
      { y: 1.5, color: 'rgba(59,130,246,0.15)' },
      { y: 2.5, color: 'rgba(234,179,8,0.15)' },
      { y: 3.5, color: 'rgba(239,68,68,0.15)' },
    ];
    for (const zone of zones) {
      const yPos = pad.top + (1 - zone.y / maxY) * plotH;
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos);
      ctx.lineTo(w - pad.right, yPos);
      ctx.stroke();
    }
  }, [dims, revealEnabled, revealHistory]);

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
  }, [bandMeans, bandStds, revealHistory]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Kappa (Volatility Multiplier)</h3>

      {/* Large number display */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold" style={{ color: label.color }}>
          {clamped.toFixed(2)}
        </span>
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: label.color + '20', color: label.color }}>
          {label.text}
        </span>
        {revealEnabled && revealData && (
          <span className="text-xs text-purple-400 ml-auto">
            Actual: {revealData.kappa_t.toFixed(3)}
          </span>
        )}
      </div>

      {/* Canvas timeline */}
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
