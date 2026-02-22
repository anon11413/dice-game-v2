import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisStore } from '../../../store/analysisStore';
import { DEFAULT_CONFIG } from '../../../engine/constants';
import { diceColorRGB } from '../../../utils/colorScale';

export function EventRadar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 160 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const eventLogRef = useRef<{ tick: number; direction: string; col: number }[]>([]);
  const tickRef = useRef(0);

  const latestColMeans = useAnalysisStore((s) => s.latestColMeans);
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const revealData = useAnalysisStore((s) => s.revealData);

  // Band 8 is index 7 in the 10-band array
  const band8Means = latestColMeans ? latestColMeans[7] : null;

  // Detect events from band8 column means
  useEffect(() => {
    tickRef.current++;
    if (!band8Means) return;

    for (let col = 0; col < band8Means.length; col++) {
      const val = band8Means[col];
      if (val >= DEFAULT_CONFIG.EVENT_HIGH_THRESH) {
        const log = eventLogRef.current;
        // Avoid duplicate consecutive logs for the same column
        if (log.length === 0 || log[log.length - 1].col !== col || log[log.length - 1].tick < tickRef.current - 5) {
          log.push({ tick: tickRef.current, direction: 'HIGH', col });
          if (log.length > 20) log.shift();
        }
      } else if (val <= DEFAULT_CONFIG.EVENT_LOW_THRESH) {
        const log = eventLogRef.current;
        if (log.length === 0 || log[log.length - 1].col !== col || log[log.length - 1].tick < tickRef.current - 5) {
          log.push({ tick: tickRef.current, direction: 'LOW', col });
          if (log.length > 20) log.shift();
        }
      }
    }
    dirtyRef.current = true;
  }, [band8Means]);

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

    if (!band8Means) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting band data...', w / 2, h / 2);
      return;
    }

    const pad = { top: 10, right: 10, bottom: 20, left: 30 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    // Y axis: 1-20
    const minY = 1;
    const maxY = 20;
    const yRange = maxY - minY;

    const toX = (col: number) => pad.left + (col / 99) * plotW;
    const toY = (val: number) => pad.top + (1 - (val - minY) / yRange) * plotH;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (const yVal of [5, 10, 15]) {
      const y = toY(yVal);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
    }

    // Threshold lines
    // High threshold (red dashed)
    const highY = toY(DEFAULT_CONFIG.EVENT_HIGH_THRESH);
    ctx.beginPath();
    ctx.moveTo(pad.left, highY);
    ctx.lineTo(w - pad.right, highY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Low threshold (blue dashed)
    const lowY = toY(DEFAULT_CONFIG.EVENT_LOW_THRESH);
    ctx.beginPath();
    ctx.moveTo(pad.left, lowY);
    ctx.lineTo(w - pad.right, lowY);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scatter dots
    for (let col = 0; col < band8Means.length; col++) {
      const val = band8Means[col];
      const x = toX(col);
      const y = toY(val);
      const rgb = diceColorRGB(Math.round(Math.max(1, Math.min(20, val))));

      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

      // Highlight dots crossing thresholds
      if (val >= DEFAULT_CONFIG.EVENT_HIGH_THRESH || val <= DEFAULT_CONFIG.EVENT_LOW_THRESH) {
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.globalAlpha = 0.6;
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Y axis labels
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const yVal of [1, 5, 10, 15, 20]) {
      ctx.fillText(yVal.toString(), pad.left - 4, toY(yVal));
    }

    // X axis label
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Agent Columns (0-99)', w / 2, h - 10);

    // Threshold labels
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`HIGH ${DEFAULT_CONFIG.EVENT_HIGH_THRESH}`, w - pad.right - 40, highY - 6);
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`LOW ${DEFAULT_CONFIG.EVENT_LOW_THRESH}`, w - pad.right - 36, lowY + 8);
  }, [dims, band8Means]);

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
  }, [band8Means]);

  const recentEvents = eventLogRef.current.slice(-5).reverse();

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-300">Event Radar (Band 8)</h3>
        {revealEnabled && revealData && revealData.event_active && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
            EVENT: {revealData.event_active.direction > 0 ? 'UP' : 'DOWN'} ({revealData.event_active.ticksRemaining}t)
          </span>
        )}
        {revealEnabled && revealData && !revealData.event_active && (
          <span className="text-xs text-gray-500">No active event</span>
        )}
      </div>

      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>

      {/* Event history strip */}
      <div className="mt-1.5 space-y-0.5 max-h-16 overflow-y-auto">
        {recentEvents.length === 0 && (
          <span className="text-[10px] text-gray-600">No threshold crossings detected</span>
        )}
        {recentEvents.map((evt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${evt.direction === 'HIGH' ? 'bg-red-500' : 'bg-blue-500'}`} />
            <span className="text-[10px] text-gray-400">
              t={evt.tick}: Col {evt.col} crossed {evt.direction} threshold
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
