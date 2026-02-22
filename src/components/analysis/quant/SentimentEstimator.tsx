import { useRef, useEffect, useCallback, useState } from 'react';
import { useDiceStore } from '../../../store/diceStore';
import { useAnalysisStore } from '../../../store/analysisStore';

const ZONE_LABELS = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'];
const ZONE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

function getSentimentZone(value: number): { label: string; color: string } {
  if (value <= 20) return { label: ZONE_LABELS[0], color: ZONE_COLORS[0] };
  if (value <= 40) return { label: ZONE_LABELS[1], color: ZONE_COLORS[1] };
  if (value <= 60) return { label: ZONE_LABELS[2], color: ZONE_COLORS[2] };
  if (value <= 80) return { label: ZONE_LABELS[3], color: ZONE_COLORS[3] };
  return { label: ZONE_LABELS[4], color: ZONE_COLORS[4] };
}

export function SentimentEstimator() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 160 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const smoothedRef = useRef(0.5);
  const historyRef = useRef<number[]>([]);

  const bandMeans = useDiceStore((s) => s.bandMeans);
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const revealData = useAnalysisStore((s) => s.revealData);
  const revealHistory = useAnalysisStore((s) => s.revealHistory);

  // Estimate sentiment from band9 (index 8)
  const sNorm = (bandMeans[8] - 1) / 19;
  const smoothed = 0.92 * smoothedRef.current + 0.08 * sNorm;
  const clamped = Math.max(0, Math.min(1, smoothed));
  smoothedRef.current = clamped;
  const displayValue = clamped * 100;

  const zone = getSentimentZone(displayValue);

  // Accumulate history
  useEffect(() => {
    const hist = historyRef.current;
    hist.push(clamped);
    if (hist.length > 200) hist.shift();
    dirtyRef.current = true;
  }, [clamped]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(140, Math.floor(w * 0.55)) });
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

    const cx = w / 2;
    const cy = h * 0.78;
    const radius = Math.min(cx - 16, cy - 16);
    const arcWidth = radius * 0.2;
    const startAngle = Math.PI;

    // Draw colored arc sections (5 zones)
    const zoneAngles = [
      { start: Math.PI, end: Math.PI + Math.PI * 0.2, color: '#ef4444' },
      { start: Math.PI + Math.PI * 0.2, end: Math.PI + Math.PI * 0.4, color: '#f97316' },
      { start: Math.PI + Math.PI * 0.4, end: Math.PI + Math.PI * 0.6, color: '#eab308' },
      { start: Math.PI + Math.PI * 0.6, end: Math.PI + Math.PI * 0.8, color: '#22c55e' },
      { start: Math.PI + Math.PI * 0.8, end: Math.PI + Math.PI, color: '#16a34a' },
    ];

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, 2 * Math.PI);
    ctx.lineWidth = arcWidth + 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineCap = 'butt';
    ctx.stroke();

    for (const section of zoneAngles) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, section.start, section.end);
      ctx.lineWidth = arcWidth;
      ctx.strokeStyle = section.color;
      ctx.globalAlpha = 0.8;
      ctx.lineCap = 'butt';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Needle: sentiment 0-100 maps to PI..2PI
    const frac = displayValue / 100;
    const needleAngle = startAngle + frac * Math.PI;
    const needleLen = radius - arcWidth * 0.4;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = zone.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Value text
    ctx.font = `bold ${Math.max(16, w * 0.08)}px sans-serif`;
    ctx.fillStyle = zone.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.round(displayValue).toString(), cx, cy - 6);

    // Label below
    ctx.font = `bold ${Math.max(10, w * 0.04)}px sans-serif`;
    ctx.fillStyle = zone.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(zone.label, cx, cy + 6);

    // Min/max labels
    ctx.font = `${Math.max(8, w * 0.03)}px sans-serif`;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('0', cx - radius - 4, cy + 4);
    ctx.textAlign = 'right';
    ctx.fillText('100', cx + radius + 4, cy + 4);
  }, [dims, displayValue, zone]);

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

    const data = historyRef.current;
    if (data.length < 2) return;

    const pad = 4;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    // Estimated line
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = pad + (i / (data.length - 1)) * plotW;
      const y = pad + (1 - data[i]) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Actual line (if reveal mode)
    if (revealEnabled && revealHistory.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < revealHistory.length; i++) {
        const x = pad + (i / (revealHistory.length - 1)) * plotW;
        const y = pad + (1 - revealHistory[i].sentiment_t) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Midline
    ctx.beginPath();
    ctx.moveTo(pad, pad + plotH / 2);
    ctx.lineTo(pad + plotW, pad + plotH / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }, [dims, revealEnabled, revealHistory]);

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
  }, [bandMeans, revealHistory]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-300">Sentiment (Fear & Greed)</h3>
        {revealEnabled && revealData && (
          <span className="text-xs text-purple-400">
            Actual: {(revealData.sentiment_t * 100).toFixed(1)}
          </span>
        )}
      </div>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Sparkline: estimated vs actual */}
      <div className="mt-1">
        <div className="flex items-center gap-3 mb-0.5">
          <span className="text-[10px] text-gray-500">History (200 ticks)</span>
          {revealEnabled && (
            <span className="text-[10px] text-purple-400">-- Actual</span>
          )}
        </div>
        <canvas ref={sparkRef} className="w-full" style={{ height: 40 }} />
      </div>
    </div>
  );
}
