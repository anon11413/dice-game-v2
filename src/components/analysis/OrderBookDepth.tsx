import { useEffect, useRef } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { useSimulation } from '../../bridge/useSimulation';

/**
 * Classic depth chart: bids (green, cumulative) on left, asks (red, cumulative) on right.
 * Rendered with Canvas for performance.
 */
export function OrderBookDepth() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bookSnapshot = useMarketStore((s) => s.bookSnapshot);
  const { requestBookSnapshot } = useSimulation();

  // Request book data periodically
  useEffect(() => {
    const interval = setInterval(() => requestBookSnapshot(), 500);
    return () => clearInterval(interval);
  }, [requestBookSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bookSnapshot) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const { bids, asks } = bookSnapshot;
    if (bids.length === 0 && asks.length === 0) return;

    // Compute cumulative depth
    const bidCum: { price: number; cumSize: number }[] = [];
    let cumBid = 0;
    for (const b of bids) {
      cumBid += b.totalSize;
      bidCum.push({ price: b.price, cumSize: cumBid });
    }

    const askCum: { price: number; cumSize: number }[] = [];
    let cumAsk = 0;
    for (const a of asks) {
      cumAsk += a.totalSize;
      askCum.push({ price: a.price, cumSize: cumAsk });
    }

    const maxDepth = Math.max(cumBid, cumAsk, 1);
    const midPrice = bookSnapshot.bestBid && bookSnapshot.bestAsk
      ? (bookSnapshot.bestBid + bookSnapshot.bestAsk) / 2
      : bids.length > 0 ? bids[0].price : asks.length > 0 ? asks[0].price : 100;

    // Price range
    const allPrices = [...bidCum.map(b => b.price), ...askCum.map(a => a.price)];
    const minP = Math.min(...allPrices);
    const maxP = Math.max(...allPrices);
    const priceRange = Math.max(maxP - minP, 0.01);

    const toX = (p: number) => ((p - minP) / priceRange) * W;
    const toY = (d: number) => H - (d / maxDepth) * (H - 10);

    // Draw bid area (green)
    ctx.beginPath();
    ctx.moveTo(toX(bidCum[0]?.price ?? midPrice), H);
    for (const b of bidCum) {
      ctx.lineTo(toX(b.price), toY(b.cumSize));
    }
    if (bidCum.length > 0) {
      ctx.lineTo(toX(bidCum[bidCum.length - 1].price), H);
    }
    ctx.closePath();
    ctx.fillStyle = '#22c55e20';
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < bidCum.length; i++) {
      const fn = i === 0 ? 'moveTo' : 'lineTo';
      ctx[fn](toX(bidCum[i].price), toY(bidCum[i].cumSize));
    }
    ctx.stroke();

    // Draw ask area (red)
    ctx.beginPath();
    ctx.moveTo(toX(askCum[0]?.price ?? midPrice), H);
    for (const a of askCum) {
      ctx.lineTo(toX(a.price), toY(a.cumSize));
    }
    if (askCum.length > 0) {
      ctx.lineTo(toX(askCum[askCum.length - 1].price), H);
    }
    ctx.closePath();
    ctx.fillStyle = '#ef444420';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < askCum.length; i++) {
      const fn = i === 0 ? 'moveTo' : 'lineTo';
      ctx[fn](toX(askCum[i].price), toY(askCum[i].cumSize));
    }
    ctx.stroke();

    // Mid-price line
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(toX(midPrice), 0);
    ctx.lineTo(toX(midPrice), H);
    ctx.stroke();
    ctx.setLineDash([]);

  }, [bookSnapshot]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Order Book Depth</h3>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        className="w-full rounded border border-gray-800"
      />
    </div>
  );
}
