import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { useDiceStore } from '../../../store/diceStore';

const BAND_LABELS = [
  'Scalp', 'Swing', 'Pos', 'Fund', 'Short',
  'MM', 'Vol', 'Event', 'Sent', 'Regime',
];

const CORR_HISTORY_LEN = 100;

/** Pearson correlation between two arrays */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;

  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
    sumAB += a[i] * b[i];
    sumA2 += a[i] * a[i];
    sumB2 += b[i] * b[i];
  }

  const num = n * sumAB - sumA * sumB;
  const den = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));
  if (den === 0) return 0;
  return num / den;
}

/** Map r value (-1 to 1) to color: blue (neg) -> white (0) -> red (pos) */
function rToColor(r: number): string {
  const clamped = Math.max(-1, Math.min(1, r));
  if (clamped >= 0) {
    const t = clamped;
    const red = 255;
    const green = Math.round(255 * (1 - t));
    const blue = Math.round(255 * (1 - t));
    return `rgb(${red},${green},${blue})`;
  } else {
    const t = -clamped;
    const red = Math.round(255 * (1 - t));
    const green = Math.round(255 * (1 - t));
    const blue = 255;
    return `rgb(${red},${green},${blue})`;
  }
}

export function CorrelationHeatmap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const bandMeansHistory = useDiceStore((s) => s.bandMeansHistory);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);
  const corrMatrixRef = useRef<number[][]>([]);

  // Compute correlation matrix
  const corrMatrix = useMemo(() => {
    const matrix: number[][] = [];
    for (let i = 0; i < 10; i++) {
      matrix[i] = [];
      const histI = (bandMeansHistory[i] ?? []).slice(-CORR_HISTORY_LEN);
      for (let j = 0; j < 10; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i]; // symmetric
        } else {
          const histJ = (bandMeansHistory[j] ?? []).slice(-CORR_HISTORY_LEN);
          matrix[i][j] = pearson(histI, histJ);
        }
      }
    }
    return matrix;
  }, [bandMeansHistory]);

  corrMatrixRef.current = corrMatrix;

  const prevMatrixRef = useRef(corrMatrix);
  if (prevMatrixRef.current !== corrMatrix) {
    dirtyRef.current = true;
    prevMatrixRef.current = corrMatrix;
  }

  const draw = useCallback(() => {
    if (!dirtyRef.current) {
      animRef.current = requestAnimationFrame(draw);
      return;
    }
    dirtyRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const labelSpace = 40;
    const gridSize = Math.min(W - labelSpace, H - labelSpace);
    const cellSize = gridSize / 10;
    const offsetX = labelSpace;
    const offsetY = labelSpace;

    const matrix = corrMatrixRef.current;

    // Draw cells
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const r = matrix[row]?.[col] ?? 0;
        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;

        ctx.fillStyle = rToColor(r);
        ctx.fillRect(x, y, cellSize - 1, cellSize - 1);

        // Show r value in cell if it's big enough
        if (cellSize >= 20) {
          ctx.fillStyle = Math.abs(r) > 0.5 ? '#000000' : '#ffffff80';
          ctx.font = `${Math.min(8, cellSize / 3)}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(r.toFixed(1), x + cellSize / 2, y + cellSize / 2);
        }
      }
    }

    // Row labels (left)
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      ctx.fillText(BAND_LABELS[i], offsetX - 4, offsetY + i * cellSize + cellSize / 2);
    }

    // Column labels (top)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i < 10; i++) {
      ctx.save();
      ctx.translate(offsetX + i * cellSize + cellSize / 2, offsetY - 4);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(BAND_LABELS[i], 0, 0);
      ctx.restore();
    }

    // Color scale legend
    const legendX = offsetX;
    const legendY = offsetY + gridSize + 12;
    const legendW = gridSize;
    const legendH = 8;

    const grd = ctx.createLinearGradient(legendX, 0, legendX + legendW, 0);
    grd.addColorStop(0, rToColor(-1));
    grd.addColorStop(0.5, rToColor(0));
    grd.addColorStop(1, rToColor(1));
    ctx.fillStyle = grd;
    ctx.fillRect(legendX, legendY, legendW, legendH);

    ctx.fillStyle = '#6b7280';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('-1', legendX, legendY + legendH + 2);
    ctx.textAlign = 'center';
    ctx.fillText('0', legendX + legendW / 2, legendY + legendH + 2);
    ctx.textAlign = 'right';
    ctx.fillText('+1', legendX + legendW, legendY + legendH + 2);

    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // Mouse move handler for tooltip
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const labelSpace = 40;
      const gridSize = Math.min(canvas.width - labelSpace, canvas.height - labelSpace);
      const cellSize = gridSize / 10;

      const col = Math.floor((mx - labelSpace) / cellSize);
      const row = Math.floor((my - labelSpace) / cellSize);

      if (row >= 0 && row < 10 && col >= 0 && col < 10) {
        const r = corrMatrixRef.current[row]?.[col] ?? 0;
        setTooltip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          text: `${BAND_LABELS[row]} / ${BAND_LABELS[col]}: r = ${r.toFixed(3)}`,
        });
      } else {
        setTooltip(null);
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Band Correlation Matrix</h3>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={340}
          height={320}
          className="w-full rounded border border-gray-800 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
        {tooltip && (
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-gray-200 shadow-lg z-10 whitespace-nowrap"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 8,
            }}
          >
            {tooltip.text}
          </div>
        )}
      </div>
    </div>
  );
}
