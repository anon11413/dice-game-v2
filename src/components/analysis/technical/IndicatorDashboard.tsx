import { useEffect, useRef, useMemo } from 'react';
import { useMarketStore, EMPTY_CANDLES } from '../../../store/marketStore';
import { RESOLUTIONS } from '../../../engine/constants';
import { rsi, macd, bollingerBands, ttmSqueeze } from '../../../engine/aggregation/indicators';

// ---- RSI Gauge ----
function RsiGauge({ value }: { value: number | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H - 10;
    const radius = Math.min(cx - 8, cy - 8);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, Math.PI, 0, false);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1e293b';
    ctx.stroke();

    // Colored segments: green (0-30), blue (30-70), red (70-100)
    const drawSegment = (startPct: number, endPct: number, color: string) => {
      const startAngle = Math.PI + (startPct / 100) * Math.PI;
      const endAngle = Math.PI + (endPct / 100) * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, endAngle, false);
      ctx.lineWidth = 10;
      ctx.strokeStyle = color;
      ctx.stroke();
    };

    drawSegment(0, 30, '#22c55e40');
    drawSegment(30, 70, '#3b82f640');
    drawSegment(70, 100, '#ef444440');

    if (value !== null) {
      // Needle
      const angle = Math.PI + (value / 100) * Math.PI;
      const needleLen = radius - 8;
      const nx = cx + Math.cos(angle) * needleLen;
      const ny = cy + Math.sin(angle) * needleLen;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(nx, ny);
      ctx.lineWidth = 2;
      const needleColor = value > 70 ? '#ef4444' : value < 30 ? '#22c55e' : '#3b82f6';
      ctx.strokeStyle = needleColor;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = needleColor;
      ctx.fill();

      // Value text
      ctx.fillStyle = needleColor;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(value.toFixed(1), cx, cy - radius - 4);
    }

    // Label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RSI (14)', cx, H - 1);

    // Scale labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('0', cx - radius - 4, cy + 10);
    ctx.textAlign = 'right';
    ctx.fillText('100', cx + radius + 4, cy + 10);
    ctx.textAlign = 'center';
    ctx.fillText('50', cx, cy - radius + 14);
  }, [value]);

  return <canvas ref={canvasRef} width={140} height={90} className="w-full" />;
}

// ---- MACD Traffic Light ----
function MacdLight({ data }: { data: { histogram: number | null; prevHist: number | null } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const { histogram, prevHist } = data;

    // Determine signal: green=histogram positive & increasing, red=negative & decreasing, yellow=transitioning
    let signal: 'green' | 'yellow' | 'red' = 'yellow';
    if (histogram !== null && prevHist !== null) {
      if (histogram > 0 && histogram > prevHist) signal = 'green';
      else if (histogram < 0 && histogram < prevHist) signal = 'red';
    }

    const cx = W / 2;
    const dotRadius = 14;
    const dots = [
      { y: 22, active: signal === 'red', color: '#ef4444', dim: '#ef444430' },
      { y: 45, active: signal === 'yellow', color: '#f59e0b', dim: '#f59e0b30' },
      { y: 68, active: signal === 'green', color: '#22c55e', dim: '#22c55e30' },
    ];

    // Housing
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(cx - 18, 6, 36, 76, 6);
    ctx.fill();
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.stroke();

    for (const dot of dots) {
      ctx.beginPath();
      ctx.arc(cx, dot.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = dot.active ? dot.color : dot.dim;
      ctx.fill();
      if (dot.active) {
        ctx.shadowColor = dot.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // Label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MACD', cx, H - 1);
  }, [data]);

  return <canvas ref={canvasRef} width={140} height={90} className="w-full" />;
}

// ---- Bollinger Width Bar ----
function BollingerWidth({ width, maxWidth }: { width: number | null; maxWidth: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const barY = 25;
    const barH = 20;
    const barX = 10;
    const barW = W - 20;

    // Background bar
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    if (width !== null && maxWidth > 0) {
      const pct = Math.min(width / maxWidth, 1);

      // Gradient: blue (narrow/squeeze) -> yellow -> red (wide/volatile)
      const grd = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grd.addColorStop(0, '#3b82f6');
      grd.addColorStop(0.5, '#f59e0b');
      grd.addColorStop(1, '#ef4444');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 4);
      ctx.fill();

      // Pointer
      const px = barX + barW * pct;
      ctx.beginPath();
      ctx.moveTo(px, barY - 4);
      ctx.lineTo(px - 4, barY - 10);
      ctx.lineTo(px + 4, barY - 10);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Value text
      ctx.fillStyle = '#e5e7eb';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(width.toFixed(2), W / 2, barY + barH + 14);

      // Labels
      ctx.fillStyle = '#6b7280';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Squeeze', barX, barY + barH + 14);
      ctx.textAlign = 'right';
      ctx.fillText('Volatile', barX + barW, barY + barH + 14);
    }

    // Title
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BB Width', W / 2, H - 1);
  }, [width, maxWidth]);

  return <canvas ref={canvasRef} width={140} height={90} className="w-full" />;
}

// ---- TTM Squeeze LED ----
function TtmSqueezeLed({ squeeze }: { squeeze: { momentum: number | null; squeezeOn: boolean } | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;

    // LED indicator
    const ledY = 18;
    const ledR = 8;
    const isOn = squeeze?.squeezeOn ?? false;

    ctx.beginPath();
    ctx.arc(cx, ledY, ledR, 0, Math.PI * 2);
    ctx.fillStyle = isOn ? '#ef4444' : '#22c55e';
    ctx.fill();
    if (isOn) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Label
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isOn ? 'SQUEEZE ON' : 'SQUEEZE OFF', cx, ledY + ledR + 12);

    // Momentum bar
    const momentum = squeeze?.momentum ?? 0;
    const barY = 50;
    const barH = 14;
    const barX = 10;
    const barW = W - 20;
    const midX = barX + barW / 2;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fill();

    if (momentum !== 0) {
      const maxMom = 2; // scale
      const pct = Math.min(Math.abs(momentum) / maxMom, 1);
      const momColor = momentum > 0 ? '#22c55e' : '#ef4444';
      ctx.fillStyle = momColor;

      if (momentum > 0) {
        ctx.beginPath();
        ctx.roundRect(midX, barY, pct * (barW / 2), barH, 3);
        ctx.fill();
      } else {
        const w = pct * (barW / 2);
        ctx.beginPath();
        ctx.roundRect(midX - w, barY, w, barH, 3);
        ctx.fill();
      }
    }

    // Center mark
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX, barY);
    ctx.lineTo(midX, barY + barH);
    ctx.stroke();

    // Bottom label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TTM Squeeze', cx, H - 1);
  }, [squeeze]);

  return <canvas ref={canvasRef} width={140} height={90} className="w-full" />;
}

export function IndicatorDashboard() {
  const candles = useMarketStore((s) => s.candles.get(RESOLUTIONS.ONE_SEC) ?? EMPTY_CANDLES);

  const computed = useMemo(() => {
    if (candles.length < 2) {
      return {
        rsiValue: null,
        macdData: { histogram: null, prevHist: null },
        bbWidth: null,
        bbMaxWidth: 1,
        squeezeData: null,
      };
    }

    // RSI
    const rsiVals = rsi(candles);
    const lastRsi = rsiVals.filter((v): v is number => v !== null);
    const rsiValue = lastRsi.length > 0 ? lastRsi[lastRsi.length - 1] : null;

    // MACD
    const macdVals = macd(candles);
    const validMacd = macdVals.filter((d) => d.histogram !== null);
    const lastMacd = validMacd.length > 0 ? validMacd[validMacd.length - 1] : null;
    const prevMacd = validMacd.length > 1 ? validMacd[validMacd.length - 2] : null;

    // Bollinger
    const bbVals = bollingerBands(candles);
    const validBb = bbVals.filter((d) => d.upper !== null && d.lower !== null);
    const lastBb = validBb.length > 0 ? validBb[validBb.length - 1] : null;
    const bbWidth = lastBb && lastBb.upper !== null && lastBb.lower !== null
      ? lastBb.upper - lastBb.lower
      : null;
    const bbMaxWidth = Math.max(
      ...validBb.map((d) => (d.upper! - d.lower!)),
      1
    );

    // TTM Squeeze
    const squeezeVals = ttmSqueeze(candles);
    const validSqueeze = squeezeVals.filter((d) => d.momentum !== null);
    const squeezeData = validSqueeze.length > 0
      ? validSqueeze[validSqueeze.length - 1]
      : null;

    return {
      rsiValue,
      macdData: {
        histogram: lastMacd?.histogram ?? null,
        prevHist: prevMacd?.histogram ?? null,
      },
      bbWidth,
      bbMaxWidth,
      squeezeData,
    };
  }, [candles]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Indicator Dashboard</h3>
      <div className="grid grid-cols-4 gap-1">
        <RsiGauge value={computed.rsiValue} />
        <MacdLight data={computed.macdData} />
        <BollingerWidth width={computed.bbWidth} maxWidth={computed.bbMaxWidth} />
        <TtmSqueezeLed squeeze={computed.squeezeData} />
      </div>
    </div>
  );
}
