import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisStore } from '../../../store/analysisStore';

const SOURCE_COLORS: Record<string, string> = {
  MM: '#3b82f6',
  SCALP: '#06b6d4',
  SWING: '#22c55e',
  POS: '#eab308',
  VALUE: '#a855f7',
  SHORT: '#ef4444',
  SQUEEZE: '#f97316',
};

const SOURCE_ORDER = ['MM', 'SCALP', 'SWING', 'POS', 'VALUE', 'SHORT', 'SQUEEZE'];

function drawDonut(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  segments: { source: string; value: number }[],
  label: string,
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    // Empty donut
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();

    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data', cx, cy);
    return;
  }

  let startAngle = -Math.PI / 2;
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const sweep = (seg.value / total) * Math.PI * 2;
    const endAngle = startAngle + sweep;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = SOURCE_COLORS[seg.source] || '#6b7280';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Segment border
    ctx.strokeStyle = '#0d1117';
    ctx.lineWidth = 1;
    ctx.stroke();

    startAngle = endAngle;
  }

  // Center label
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy - 6);

  ctx.font = '9px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(total.toLocaleString(), cx, cy + 8);
}

export function OrderSourceBreakdown() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 180 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const depthBySource = useAnalysisStore((s) => s.depthBySource);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(150, Math.floor(w * 0.55)) });
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

    if (!depthBySource) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting depth data...', w / 2, h / 2);
      return;
    }

    const bidSegments: { source: string; value: number }[] = [];
    const askSegments: { source: string; value: number }[] = [];

    for (const src of SOURCE_ORDER) {
      const d = depthBySource[src];
      if (d) {
        bidSegments.push({ source: src, value: d.bidSize });
        askSegments.push({ source: src, value: d.askSize });
      }
    }

    // Also include any sources not in SOURCE_ORDER
    for (const [src, d] of Object.entries(depthBySource)) {
      if (!SOURCE_ORDER.includes(src)) {
        bidSegments.push({ source: src, value: d.bidSize });
        askSegments.push({ source: src, value: d.askSize });
      }
    }

    const halfW = w / 2;
    const radius = Math.min(halfW * 0.38, h * 0.42);
    const innerRadius = radius * 0.55;

    // Left donut: Bids
    drawDonut(ctx, halfW * 0.5, h * 0.45, radius, innerRadius, bidSegments, 'Bids');

    // Right donut: Asks
    drawDonut(ctx, halfW * 1.5, h * 0.45, radius, innerRadius, askSegments, 'Asks');

    // Titles
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#22c55e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Bid Depth', halfW * 0.5, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Ask Depth', halfW * 1.5, 4);
  }, [dims, depthBySource]);

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
  }, [depthBySource]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Order Source Breakdown</h3>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
        {SOURCE_ORDER.map((src) => (
          <div key={src} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-sm"
              style={{ backgroundColor: SOURCE_COLORS[src] }}
            />
            <span className="text-[9px] text-gray-400">{src}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
