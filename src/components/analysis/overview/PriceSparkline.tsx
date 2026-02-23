import { useRef, useEffect, useCallback, useState } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';

export function PriceSparkline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 100 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const price = useMarketStore((s) => s.price);
  const priceChangePct = useMarketStore((s) => s.priceChangePct);
  const candles = useMarketStore((s) => s.candles);
  const tickCandles = candles.get(RESOLUTIONS.ONE_SEC);

  // Get last 100 close prices
  const prices = tickCandles
    ? tickCandles.slice(-100).map((c) => c.close)
    : [price];

  const isUp = prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : true;

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        setDims({ w, h: 100 });
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

    if (prices.length < 2) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#6b7280';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for data...', w / 2, h / 2);
      return;
    }

    const padding = { top: 8, bottom: 8, left: 2, right: 2 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 1;

    const toX = (i: number) => padding.left + (i / (prices.length - 1)) * chartW;
    const toY = (p: number) => padding.top + (1 - (p - minP) / range) * chartH;

    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const gradientTop = isUp ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)';
    const gradientBottom = isUp ? 'rgba(34,197,94,0.0)' : 'rgba(239,68,68,0.0)';

    // Draw gradient fill
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(prices[0]));
    for (let i = 1; i < prices.length; i++) {
      ctx.lineTo(toX(i), toY(prices[i]));
    }
    ctx.lineTo(toX(prices.length - 1), h);
    ctx.lineTo(toX(0), h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, gradientTop);
    gradient.addColorStop(1, gradientBottom);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(prices[0]));
    for (let i = 1; i < prices.length; i++) {
      ctx.lineTo(toX(i), toY(prices[i]));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw current price dot
    const lastX = toX(prices.length - 1);
    const lastY = toY(prices[prices.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }, [dims, prices, isUp]);

  // Render loop
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
  }, [prices, price]);

  const changeColor = priceChangePct >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-300">Price</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tabular-nums">
            ${price.toFixed(2)}
          </span>
          <span className={`text-sm font-medium tabular-nums ${changeColor}`}>
            {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
