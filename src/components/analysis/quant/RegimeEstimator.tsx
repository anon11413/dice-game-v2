import { useRef, useEffect, useCallback, useState } from 'react';
import { useDiceStore } from '../../../store/diceStore';
import { useAnalysisStore } from '../../../store/analysisStore';

// Engine uses colMeans[25] for regime — we use that when available, else fall back to band mean

/** Estimate trendPersistence from band10 (index 9) mean */
function estimateTrendPersistence(mean: number): number {
  if (mean >= 14) return 0.5 + ((mean - 14) / 6) * 0.4;
  if (mean <= 7) return 0.1 + ((mean - 1) / 6) * 0.2;
  return 0.3 + ((mean - 7) / 7) * 0.2;
}

/** Estimate reversalProb from band10 (index 9) std */
function estimateReversalProb(std: number): number {
  return Math.max(0, Math.min(0.4, (std - 4) / 6));
}

function getRegimeLabel(tp: number): string {
  if (tp >= 0.6) return 'Trending';
  if (tp <= 0.25) return 'Choppy';
  return 'Ranging';
}

function getRegimeLabelColor(tp: number): string {
  if (tp >= 0.6) return '#22c55e';
  if (tp <= 0.25) return '#ef4444';
  return '#eab308';
}

function drawSemicircleGauge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  value: number,
  maxVal: number,
  label: string,
  color: string,
  w: number,
) {
  const arcWidth = radius * 0.2;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;

  // Background track
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.lineWidth = arcWidth;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineCap = 'butt';
  ctx.stroke();

  // Value arc
  const frac = Math.max(0, Math.min(1, value / maxVal));
  const valueAngle = startAngle + frac * Math.PI;
  if (frac > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, valueAngle);
    ctx.lineWidth = arcWidth;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Needle
  const needleLen = radius - arcWidth * 0.3;
  const needleAngle = startAngle + frac * Math.PI;
  const nx = cx + Math.cos(needleAngle) * needleLen;
  const ny = cy + Math.sin(needleAngle) * needleLen;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Value text
  ctx.font = `bold ${Math.max(12, w * 0.06)}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(value.toFixed(2), cx, cy - 4);

  // Label
  ctx.font = `${Math.max(9, w * 0.035)}px sans-serif`;
  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, cy + 4);
}

export function RegimeEstimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 160 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const tpHistoryRef = useRef<number[]>([]);

  const bandMeans = useDiceStore((s) => s.bandMeans);
  const bandStds = useDiceStore((s) => s.bandStds);
  const bandMeansHistory = useDiceStore((s) => s.bandMeansHistory);
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const revealData = useAnalysisStore((s) => s.revealData);
  const latestColMeans = useAnalysisStore((s) => s.latestColMeans);

  // Engine uses colMeans[25] of band 10 (index 9) for regime — use that when available
  const regimeSignal = latestColMeans ? latestColMeans[9][25] : bandMeans[9];
  const estimatedTP = estimateTrendPersistence(regimeSignal);
  const estimatedRP = estimateReversalProb(bandStds[9]);
  const regimeLabel = getRegimeLabel(estimatedTP);
  const regimeColor = getRegimeLabelColor(estimatedTP);

  // Accumulate trendPersistence history from bandMeansHistory[9]
  useEffect(() => {
    const hist = bandMeansHistory[9];
    if (hist && hist.length > 0) {
      tpHistoryRef.current = hist.map((m) => estimateTrendPersistence(m));
    }
    dirtyRef.current = true;
  }, [bandMeansHistory]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(130, Math.floor(w * 0.5)) });
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

    const halfW = w / 2;
    const gaugeRadius = Math.min(halfW * 0.4, h * 0.55);

    // Left gauge: Trend Persistence (0-1)
    drawSemicircleGauge(ctx, halfW * 0.5, h * 0.7, gaugeRadius, estimatedTP, 1.0, 'Trend Persistence', '#3b82f6', halfW);

    // Right gauge: Reversal Prob (0-0.4)
    drawSemicircleGauge(ctx, halfW * 1.5, h * 0.7, gaugeRadius, estimatedRP, 0.4, 'Reversal Prob', '#f97316', halfW);
  }, [dims, estimatedTP, estimatedRP]);

  const drawSparkline = useCallback(() => {
    const canvas = sparkRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = dims.w;
    const h = 40;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const data = tpHistoryRef.current;
    if (data.length < 2) return;

    const pad = 4;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad + (i / (data.length - 1)) * plotW;
      const y = pad + (1 - data[i]) * plotH; // 0-1 range
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill below
    ctx.lineTo(pad + plotW, pad + plotH);
    ctx.lineTo(pad, pad + plotH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(59,130,246,0.1)';
    ctx.fill();
  }, [dims]);

  useEffect(() => {
    dirtyRef.current = true;
    const tick = () => {
      if (dirtyRef.current) {
        draw();
        drawSparkline();
        dirtyRef.current = false;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, drawSparkline]);

  useEffect(() => {
    dirtyRef.current = true;
  }, [estimatedTP, estimatedRP, bandMeansHistory]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Regime Estimator</h3>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Regime label */}
      <div className="flex items-center justify-center gap-2 mt-1 mb-1">
        <span
          className="text-sm font-bold"
          style={{ color: regimeColor }}
        >
          {regimeLabel}
        </span>
        {revealEnabled && revealData && (
          <span className="text-xs text-purple-400 ml-2">
            Actual: TP={revealData.regime_t.trendPersistence.toFixed(3)}, RP={revealData.regime_t.reversalProb.toFixed(3)}
          </span>
        )}
      </div>

      {/* Sparkline */}
      <div className="mt-1">
        <span className="text-[10px] text-gray-500">Trend Persistence (200 ticks)</span>
        <canvas ref={sparkRef} className="w-full" style={{ height: 40 }} />
      </div>
    </div>
  );
}
