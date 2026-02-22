import { useRef, useEffect, useCallback, useState } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { useDiceStore } from '../../../store/diceStore';

const LABELS = ['STRONG SELL', 'SELL', 'NEUTRAL', 'BUY', 'STRONG BUY'];
const LABEL_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

function computeScore(
  bandMeans: number[],
  bookSnapshot: { bids: { totalSize: number }[]; asks: { totalSize: number }[] } | null,
): number {
  // Momentum: bandMeans[0] > 12 bullish, < 9 bearish
  const momentum = bandMeans[0] > 12
    ? Math.min((bandMeans[0] - 12) / 8, 1)
    : bandMeans[0] < 9
      ? Math.max((bandMeans[0] - 9) / 8, -1)
      : 0;

  // Band consensus: average of bands 0-3 mapped to -1..1
  const avg03 = (bandMeans[0] + bandMeans[1] + bandMeans[2] + bandMeans[3]) / 4;
  const consensus = Math.max(-1, Math.min(1, (avg03 - 10.5) / 9.5));

  // Book imbalance
  let bookImbalance = 0;
  if (bookSnapshot) {
    const bidDepth = bookSnapshot.bids.reduce((s, l) => s + l.totalSize, 0);
    const askDepth = bookSnapshot.asks.reduce((s, l) => s + l.totalSize, 0);
    const total = bidDepth + askDepth;
    if (total > 0) {
      bookImbalance = (bidDepth - askDepth) / total;
    }
  }

  // Sentiment: bandMeans[8] mapped to -1..1
  const sentiment = Math.max(-1, Math.min(1, (bandMeans[8] - 10.5) / 9.5));

  // Weighted composite
  const score = momentum * 0.3 + consensus * 0.3 + bookImbalance * 0.2 + sentiment * 0.2;
  return Math.max(-1, Math.min(1, score));
}

function getScoreLabel(score: number): string {
  if (score <= -0.6) return LABELS[0];
  if (score <= -0.2) return LABELS[1];
  if (score <= 0.2) return LABELS[2];
  if (score <= 0.6) return LABELS[3];
  return LABELS[4];
}

function getScoreColor(score: number): string {
  if (score <= -0.6) return LABEL_COLORS[0];
  if (score <= -0.2) return LABEL_COLORS[1];
  if (score <= 0.2) return LABEL_COLORS[2];
  if (score <= 0.6) return LABEL_COLORS[3];
  return LABEL_COLORS[4];
}

export function MarketPulseGauge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 300, h: 180 });
  const dirtyRef = useRef(true);
  const animRef = useRef<number>(0);

  const bandMeans = useDiceStore((s) => s.bandMeans);
  const bookSnapshot = useMarketStore((s) => s.bookSnapshot);

  const score = computeScore(bandMeans, bookSnapshot);
  const label = getScoreLabel(score);
  const color = getScoreColor(score);

  // ResizeObserver for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        const h = Math.max(140, Math.floor(w * 0.55));
        setDims({ w, h });
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
    const cy = h * 0.8;
    const radius = Math.min(cx - 20, cy - 20);
    const arcWidth = radius * 0.18;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    // Draw colored arc sections
    const sectionAngles = [
      { start: Math.PI, end: Math.PI + Math.PI * 0.2, color: '#ef4444' },
      { start: Math.PI + Math.PI * 0.2, end: Math.PI + Math.PI * 0.4, color: '#f97316' },
      { start: Math.PI + Math.PI * 0.4, end: Math.PI + Math.PI * 0.6, color: '#eab308' },
      { start: Math.PI + Math.PI * 0.6, end: Math.PI + Math.PI * 0.8, color: '#22c55e' },
      { start: Math.PI + Math.PI * 0.8, end: Math.PI + Math.PI, color: '#16a34a' },
    ];

    for (const section of sectionAngles) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, section.start, section.end);
      ctx.lineWidth = arcWidth;
      ctx.strokeStyle = section.color;
      ctx.lineCap = 'butt';
      ctx.stroke();
    }

    // Draw track background (subtle)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.lineWidth = arcWidth + 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.stroke();

    // Re-draw colored sections on top
    for (const section of sectionAngles) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, section.start, section.end);
      ctx.lineWidth = arcWidth;
      ctx.strokeStyle = section.color;
      ctx.globalAlpha = 0.85;
      ctx.lineCap = 'butt';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw needle
    // score -1..1 maps to PI..2PI
    const needleAngle = Math.PI + ((score + 1) / 2) * Math.PI;
    const needleLen = radius - arcWidth * 0.5;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    // Needle shadow
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.stroke();

    // Needle line
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Needle center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw labels
    const labelRadius = radius + arcWidth * 0.5 + 12;
    const labelFontSize = Math.max(8, Math.min(11, w * 0.032));
    ctx.font = `bold ${labelFontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    LABELS.forEach((lbl, i) => {
      const a = Math.PI + (i / (LABELS.length - 1)) * Math.PI;
      const lx = cx + Math.cos(a) * labelRadius;
      const ly = cy + Math.sin(a) * labelRadius;
      ctx.fillStyle = LABEL_COLORS[i];
      ctx.fillText(lbl, lx, ly);
    });

    // Draw score value
    ctx.font = `bold ${Math.max(14, w * 0.06)}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, cx, cy - 8);

    // Score number
    ctx.font = `${Math.max(10, w * 0.035)}px sans-serif`;
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(`Score: ${(score * 100).toFixed(0)}`, cx, cy + 16);
  }, [dims, score, label, color]);

  // Animation loop with dirty flag
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

  // Mark dirty when data changes
  useEffect(() => {
    dirtyRef.current = true;
  }, [score]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Market Pulse</h3>
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} className="w-full" />
      </div>
    </div>
  );
}
