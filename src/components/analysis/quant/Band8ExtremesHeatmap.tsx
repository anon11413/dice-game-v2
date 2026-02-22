import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisStore } from '../../../store/analysisStore';
import { DEFAULT_CONFIG } from '../../../engine/constants';

/**
 * Scrolling 100-column x 200-tick heatmap of band 8 column means over time.
 * Shows event triggers developing column by column — quants can spot events
 * 5-10 ticks before they fire by watching columns drift toward thresholds.
 */

function colMeanToColor(val: number): [number, number, number] {
  // Map column mean (1-20) to color:
  // Near EVENT_LOW_THRESH (4) → blue, neutral (10.5) → dark gray, near EVENT_HIGH_THRESH (17) → red
  const t = Math.max(0, Math.min(1, (val - 1) / 19));

  if (t < 0.5) {
    const s = t * 2;
    return [
      Math.round(20 + s * 60),
      Math.round(40 + s * 50),
      Math.round(180 - s * 80),
    ];
  } else {
    const s = (t - 0.5) * 2;
    return [
      Math.round(80 + s * 175),
      Math.round(90 - s * 70),
      Math.round(100 - s * 80),
    ];
  }
}

export function Band8ExtremesHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(300);
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const colMeansHistory = useAnalysisStore((s) => s.colMeansHistory);

  // Extract band 8 (index 7) history
  const band8History = colMeansHistory
    ? colMeansHistory.map((snapshot) => snapshot[7])
    : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerW(Math.floor(entry.contentRect.width));
        dirtyRef.current = true;
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const COLS = 100;
  const MAX_ROWS = 200;
  const CANVAS_H = 160;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = containerW;
    const h = CANVAS_H;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (!band8History || band8History.length === 0) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting column means data...', w / 2, h / 2);
      return;
    }

    const pad = { left: 28, right: 8, top: 4, bottom: 14 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const rows = band8History.length;
    const cellW = plotW / COLS;
    const cellH = plotH / Math.min(rows, MAX_ROWS);

    // Draw heatmap (most recent at top)
    for (let row = 0; row < rows; row++) {
      const colMeans = band8History[rows - 1 - row]; // reverse: newest at top
      if (!colMeans) continue;
      const y = pad.top + row * cellH;

      for (let col = 0; col < COLS && col < colMeans.length; col++) {
        const val = colMeans[col];
        const x = pad.left + col * cellW;
        const rgb = colMeanToColor(val);

        // Brighten cells near thresholds
        let alpha = 0.7;
        if (val >= DEFAULT_CONFIG.EVENT_HIGH_THRESH) alpha = 1.0;
        else if (val <= DEFAULT_CONFIG.EVENT_LOW_THRESH) alpha = 1.0;
        else if (val >= DEFAULT_CONFIG.EVENT_HIGH_THRESH - 1.5) alpha = 0.9;
        else if (val <= DEFAULT_CONFIG.EVENT_LOW_THRESH + 1.5) alpha = 0.9;

        ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
        ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    // Threshold markers on right edge
    // High threshold marker
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`H:${DEFAULT_CONFIG.EVENT_HIGH_THRESH}`, w - 2, pad.top);

    // Low threshold marker
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`L:${DEFAULT_CONFIG.EVENT_LOW_THRESH}`, w - 2, pad.top + 10);

    // Y axis labels (time ago)
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('now', pad.left - 3, pad.top + 4);
    if (rows > 10) {
      const halfIdx = Math.floor(rows / 2);
      ctx.fillText(`-${halfIdx}`, pad.left - 3, pad.top + halfIdx * cellH);
    }
    if (rows > 1) {
      ctx.fillText(`-${rows - 1}`, pad.left - 3, pad.top + (rows - 1) * cellH);
    }

    // X axis label
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('100 Agents', w / 2, h - 10);
  }, [containerW, band8History]);

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
  }, [band8History]);

  // Compute current max/min for the info bar
  const latestColMeans = useAnalysisStore((s) => s.latestColMeans);
  const band8Current = latestColMeans ? latestColMeans[7] : null;
  let maxCol = 0, minCol = 0, maxVal = 0, minVal = 20;
  if (band8Current) {
    for (let i = 0; i < band8Current.length; i++) {
      if (band8Current[i] > maxVal) { maxVal = band8Current[i]; maxCol = i; }
      if (band8Current[i] < minVal) { minVal = band8Current[i]; minCol = i; }
    }
  }

  const highPct = band8Current
    ? Math.min(100, Math.max(0, ((maxVal - 10.5) / (DEFAULT_CONFIG.EVENT_HIGH_THRESH - 10.5)) * 100))
    : 0;
  const lowPct = band8Current
    ? Math.min(100, Math.max(0, ((10.5 - minVal) / (10.5 - DEFAULT_CONFIG.EVENT_LOW_THRESH)) * 100))
    : 0;

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Band 8 Column Extremes</h3>

      {/* Progress bars toward thresholds */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-gray-500">Max (col {maxCol})</span>
            <span className="text-[10px] font-mono text-red-400">{maxVal.toFixed(1)}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${highPct}%`,
                backgroundColor: highPct >= 100 ? '#ef4444' : highPct >= 80 ? '#f97316' : '#374151',
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-gray-500">Min (col {minCol})</span>
            <span className="text-[10px] font-mono text-blue-400">{minVal.toFixed(1)}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${lowPct}%`,
                backgroundColor: lowPct >= 100 ? '#3b82f6' : lowPct >= 80 ? '#06b6d4' : '#374151',
              }}
            />
          </div>
        </div>
      </div>

      {/* Heatmap canvas */}
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full rounded border border-gray-800" style={{ imageRendering: 'pixelated' }} />
      </div>
    </div>
  );
}
