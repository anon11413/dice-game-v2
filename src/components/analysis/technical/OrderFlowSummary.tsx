import { useEffect, useRef, useCallback } from 'react';
import { useAnalysisStore } from '../../../store/analysisStore';
import { useMarketStore } from '../../../store/marketStore';

const DISPLAY_COUNT = 50;
const BUCKET_SIZE = 65; // 1 minute = 325 ticks/min ÷ 5 ticks/update = 65 raw entries

/** Aggregate raw per-update entries into 1-minute buckets (aligned from end) */
function bucketize(raw: number[], bucketSize: number, displayCount: number): number[] {
  if (raw.length === 0) return [];
  const result: number[] = [];
  let i = raw.length;
  while (i > 0 && result.length < displayCount) {
    const chunkStart = Math.max(0, i - bucketSize);
    let sum = 0;
    for (let j = chunkStart; j < i; j++) sum += raw[j];
    result.unshift(sum);
    i = chunkStart;
  }
  return result;
}

export function OrderFlowSummary() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const buyHistory = useAnalysisStore((s) => s.buyVolumeHistory);
  const sellHistory = useAnalysisStore((s) => s.sellVolumeHistory);
  const bookSnapshot = useMarketStore((s) => s.bookSnapshot);

  // Mark dirty when data changes
  const prevDataRef = useRef({ buyHistory, sellHistory, bookSnapshot });
  if (
    prevDataRef.current.buyHistory !== buyHistory ||
    prevDataRef.current.sellHistory !== sellHistory ||
    prevDataRef.current.bookSnapshot !== bookSnapshot
  ) {
    dirtyRef.current = true;
    prevDataRef.current = { buyHistory, sellHistory, bookSnapshot };
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

    // Aggregate raw per-second entries into 1-minute buckets
    const buySlice = bucketize(buyHistory, BUCKET_SIZE, DISPLAY_COUNT);
    const sellSlice = bucketize(sellHistory, BUCKET_SIZE, DISPLAY_COUNT);
    const len = Math.max(buySlice.length, sellSlice.length);

    if (len === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for volume data...', W / 2, H / 2);
      animRef.current = requestAnimationFrame(draw);
      return;
    }

    // Chart area (leave space for imbalance bar at bottom)
    const chartH = H - 36;
    const chartY = 0;

    // Find max volume for scale
    const maxVol = Math.max(
      ...buySlice,
      ...sellSlice,
      1
    );

    const barW = Math.max(1, (W - 20) / DISPLAY_COUNT - 1);
    const offsetX = 10;

    // Compute cumulative delta
    const deltas: number[] = [];
    let cumDelta = 0;
    for (let i = 0; i < len; i++) {
      const b = i < buySlice.length ? buySlice[i] : 0;
      const s = i < sellSlice.length ? sellSlice[i] : 0;
      cumDelta += b - s;
      deltas.push(cumDelta);
    }

    const midY = chartY + chartH / 2;

    // Draw buy bars (green, going up from midline)
    for (let i = 0; i < len; i++) {
      const b = i < buySlice.length ? buySlice[i] : 0;
      const bH = (b / maxVol) * (chartH / 2 - 4);
      const x = offsetX + i * (barW + 1);
      ctx.fillStyle = '#22c55e90';
      ctx.fillRect(x, midY - bH, barW, bH);
    }

    // Draw sell bars (red, going down from midline)
    for (let i = 0; i < len; i++) {
      const s = i < sellSlice.length ? sellSlice[i] : 0;
      const sH = (s / maxVol) * (chartH / 2 - 4);
      const x = offsetX + i * (barW + 1);
      ctx.fillStyle = '#ef444490';
      ctx.fillRect(x, midY, barW, sH);
    }

    // Midline
    ctx.strokeStyle = '#ffffff20';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(offsetX, midY);
    ctx.lineTo(W - 10, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cumulative delta line overlay
    if (deltas.length > 1) {
      const deltaMin = Math.min(...deltas);
      const deltaMax = Math.max(...deltas);
      const deltaRange = Math.max(deltaMax - deltaMin, 1);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < deltas.length; i++) {
        const x = offsetX + i * (barW + 1) + barW / 2;
        const y = chartY + chartH - 4 - ((deltas[i] - deltaMin) / deltaRange) * (chartH - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Delta label
      ctx.fillStyle = '#f59e0b';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`\u0394 ${cumDelta.toFixed(0)}`, W - 12, chartY + 12);
    }

    // Volume labels
    ctx.fillStyle = '#22c55e';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Buy', offsetX, chartY + 10);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('Sell', offsetX, chartH - 2);

    // Book imbalance bar at bottom
    const barTop = H - 28;
    const barHeight = 12;
    const barLeft = 10;
    const barRight = W - 10;
    const barTotalW = barRight - barLeft;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(barLeft, barTop, barTotalW, barHeight, 3);
    ctx.fill();

    if (bookSnapshot) {
      const totalBid = bookSnapshot.bids.reduce((sum, l) => sum + l.totalSize, 0);
      const totalAsk = bookSnapshot.asks.reduce((sum, l) => sum + l.totalSize, 0);
      const total = totalBid + totalAsk;

      if (total > 0) {
        const bidPct = totalBid / total;

        // Bid side (green)
        ctx.fillStyle = '#22c55e80';
        ctx.beginPath();
        ctx.roundRect(barLeft, barTop, barTotalW * bidPct, barHeight, 3);
        ctx.fill();

        // Ask side (red)
        ctx.fillStyle = '#ef444480';
        ctx.beginPath();
        ctx.roundRect(barLeft + barTotalW * bidPct, barTop, barTotalW * (1 - bidPct), barHeight, 3);
        ctx.fill();

        // Center marker
        const centerX = barLeft + barTotalW * 0.5;
        ctx.strokeStyle = '#ffffff40';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(centerX, barTop);
        ctx.lineTo(centerX, barTop + barHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Tilt indicator arrow
        const tiltX = barLeft + barTotalW * bidPct;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(tiltX, barTop - 2);
        ctx.lineTo(tiltX - 3, barTop - 6);
        ctx.lineTo(tiltX + 3, barTop - 6);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Imbalance label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Book Imbalance', W / 2, H - 2);

    animRef.current = requestAnimationFrame(draw);
  }, [buyHistory, sellHistory, bookSnapshot]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Order Flow Summary (1 min)</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="w-full rounded border border-gray-800"
      />
    </div>
  );
}
