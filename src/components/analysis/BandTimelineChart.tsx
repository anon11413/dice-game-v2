import { useEffect, useRef } from 'react';
import { useDiceStore } from '../../store/diceStore';

const BAND_COLORS = [
  '#3b82f6', // Band 1 - blue
  '#6366f1', // Band 2 - indigo
  '#8b5cf6', // Band 3 - violet
  '#a855f7', // Band 4 - purple
  '#ef4444', // Band 5 - red
  '#f59e0b', // Band 6 - amber
  '#22c55e', // Band 7 - green
  '#06b6d4', // Band 8 - cyan
  '#ec4899', // Band 9 - pink
  '#f97316', // Band 10 - orange
];

const BAND_LABELS = ['Scalp', 'Swing', 'Pos', 'Value', 'Short', 'MM', 'Vol', 'Event', 'Sent', 'Regime'];

/**
 * Overlaid line chart showing band mean history over time.
 * Rendered with Canvas.
 */
export function BandTimelineChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bandMeansHistory = useDiceStore((s) => s.bandMeansHistory);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = '#1c233350';
    ctx.lineWidth = 1;
    // Horizontal: mark 1, 5, 10, 15, 20
    for (const v of [1, 5, 10.5, 15, 20]) {
      const y = H - ((v - 1) / 19) * H;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();

      ctx.fillStyle = '#6b728040';
      ctx.font = '9px monospace';
      ctx.fillText(v.toString(), 2, y - 2);
    }

    // Draw each band's history
    for (let b = 0; b < 10; b++) {
      const history = bandMeansHistory[b];
      if (history.length < 2) continue;

      ctx.beginPath();
      ctx.strokeStyle = BAND_COLORS[b];
      ctx.lineWidth = 1;

      for (let i = 0; i < history.length; i++) {
        const x = (i / (history.length - 1)) * W;
        const y = H - ((history[i] - 1) / 19) * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [bandMeansHistory]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Band Means Timeline</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={180}
        className="w-full rounded border border-gray-800"
      />
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
        {BAND_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1 text-[9px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BAND_COLORS[i] }} />
            <span className="text-gray-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
