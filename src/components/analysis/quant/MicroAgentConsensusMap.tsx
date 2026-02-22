import { useRef, useEffect, useCallback, useState } from 'react';
import { useAnalysisStore } from '../../../store/analysisStore';
import { diceColorRGB } from '../../../utils/colorScale';

const BAND_NAMES = [
  'Band 1 (Scalp)',
  'Band 2 (Swing)',
  'Band 3 (Position)',
  'Band 4 (F_t Drift)',
  'Band 5 (Value)',
  'Band 6 (MM)',
  'Band 7 (Kappa)',
  'Band 8 (Events)',
  'Band 9 (Sentiment)',
  'Band 10 (Regime)',
];

export function MicroAgentConsensusMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 250 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; band: number; col: number; val: number } | null>(null);

  const latestColMeans = useAnalysisStore((s) => s.latestColMeans);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: Math.max(200, Math.floor(w * 0.4)) });
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

    if (!latestColMeans || latestColMeans.length < 10) {
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Awaiting column mean data...', w / 2, h / 2);
      return;
    }

    const pad = { top: 8, right: 8, bottom: 20, left: 80 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const cols = 100;
    const bands = 10;
    const cellW = plotW / cols;
    const cellH = plotH / bands;

    // Use ImageData for performance
    const imgW = Math.ceil(plotW);
    const imgH = Math.ceil(plotH);
    const imageData = ctx.createImageData(imgW, imgH);
    const data = imageData.data;

    for (let band = 0; band < bands; band++) {
      for (let col = 0; col < cols; col++) {
        const val = latestColMeans[band][col];
        // Clamp to 1-20 and get color
        const clampedVal = Math.max(1, Math.min(20, val));
        const rgb = diceColorRGB(Math.round(clampedVal));

        const x0 = Math.floor(col * cellW);
        const x1 = Math.floor((col + 1) * cellW);
        const y0 = Math.floor(band * cellH);
        const y1 = Math.floor((band + 1) * cellH);

        for (let py = y0; py < y1 && py < imgH; py++) {
          for (let px = x0; px < x1 && px < imgW; px++) {
            const idx = (py * imgW + px) * 4;
            data[idx] = rgb[0];
            data[idx + 1] = rgb[1];
            data[idx + 2] = rgb[2];
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, pad.left, pad.top);

    // Band labels (Y axis)
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let band = 0; band < bands; band++) {
      const y = pad.top + (band + 0.5) * cellH;
      ctx.fillText(BAND_NAMES[band], pad.left - 4, y);
    }

    // X axis labels
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let col = 0; col <= 99; col += 20) {
      const x = pad.left + (col + 0.5) * cellW;
      ctx.fillText(col.toString(), x, h - 12);
    }

    // Grid lines between bands
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let band = 1; band < bands; band++) {
      const y = pad.top + band * cellH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }
  }, [dims, latestColMeans]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!latestColMeans) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = dims.w / rect.width;
    const scaleY = dims.h / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const pad = { top: 8, right: 8, bottom: 20, left: 80 };
    const plotW = dims.w - pad.left - pad.right;
    const plotH = dims.h - pad.top - pad.bottom;
    const cellW = plotW / 100;
    const cellH = plotH / 10;

    const col = Math.floor((mx - pad.left) / cellW);
    const band = Math.floor((my - pad.top) / cellH);

    if (col >= 0 && col < 100 && band >= 0 && band < 10) {
      const val = latestColMeans[band][col];
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, band, col, val });
    } else {
      setTooltip(null);
    }
  }, [dims, latestColMeans]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

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
  }, [latestColMeans]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Micro-Agent Consensus Map</h3>
      <div ref={containerRef} className="w-full relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip && (
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200 z-10"
            style={{
              left: Math.min(tooltip.x + 10, dims.w - 120),
              top: tooltip.y - 30,
            }}
          >
            <div>{BAND_NAMES[tooltip.band]}</div>
            <div>Col {tooltip.col}: {tooltip.val.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* Color scale legend */}
      <div className="flex items-center gap-1 mt-1.5">
        <span className="text-[9px] text-gray-500">1</span>
        <div className="flex-1 h-2 rounded-sm overflow-hidden flex">
          {Array.from({ length: 20 }, (_, i) => {
            const rgb = diceColorRGB(i + 1);
            return (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
              />
            );
          })}
        </div>
        <span className="text-[9px] text-gray-500">20</span>
      </div>
    </div>
  );
}
