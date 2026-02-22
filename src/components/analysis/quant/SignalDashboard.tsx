import { useRef } from 'react';
import { useDiceStore } from '../../../store/diceStore';
import { useMarketStore } from '../../../store/marketStore';
import { useAnalysisStore } from '../../../store/analysisStore';
import { RESOLUTIONS } from '../../../engine/constants';

/** Piecewise kappa estimation */
function estimateKappaRaw(mean: number, std: number): number {
  let raw: number;
  if (mean <= 5) raw = 0.3;
  else if (mean <= 8) raw = 0.3 + (mean - 5) * (0.7 / 3);
  else if (mean <= 13) raw = 1.0;
  else if (mean <= 17) raw = 1.0 + (mean - 13) * (1.5 / 4);
  else raw = 2.5 + (mean - 17) * (1.5 / 3);
  if (std > 7) raw *= 1 + (std - 7) * 0.15;
  return Math.max(0.2, Math.min(5.0, raw));
}

function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.abs(value) * 100;
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[10px] text-gray-400 w-16 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-3 bg-gray-800 rounded-full relative overflow-hidden">
        {/* Center marker */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
        {/* Bar from center */}
        <div
          className="absolute top-0 h-full rounded-full transition-all duration-300"
          style={{
            left: isPositive ? '50%' : `${50 - pct / 2}%`,
            width: `${pct / 2}%`,
            backgroundColor: color,
            opacity: 0.7,
          }}
        />
      </div>
      <span className="text-[10px] font-mono w-10 text-right" style={{ color }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

export function SignalDashboard() {
  const bandMeans = useDiceStore((s) => s.bandMeans);
  const bandStds = useDiceStore((s) => s.bandStds);
  const price = useMarketStore((s) => s.price);
  const candles = useMarketStore((s) => s.candles);
  const buyVolume = useAnalysisStore((s) => s.buyVolume);
  const sellVolume = useAnalysisStore((s) => s.sellVolume);

  const smoothedKappaRef = useRef(1.0);
  const smoothedSentRef = useRef(0.5);
  const fEstRef = useRef(100.0);
  const tickCountRef = useRef(0);

  // Kappa
  const rawKappa = estimateKappaRaw(bandMeans[6], bandStds[6]);
  smoothedKappaRef.current = 0.7 * smoothedKappaRef.current + 0.3 * rawKappa;
  const kappa = Math.max(0.2, Math.min(5.0, smoothedKappaRef.current));

  // Sentiment
  const sNorm = (bandMeans[8] - 1) / 19;
  smoothedSentRef.current = 0.92 * smoothedSentRef.current + 0.08 * sNorm;
  const sentiment = Math.max(0, Math.min(1, smoothedSentRef.current));

  // F_t estimation (simplified, drift every 65 ticks)
  tickCountRef.current++;
  if (tickCountRef.current % RESOLUTIONS.DAILY === 0) {
    const f = bandMeans[3];
    const F_prev = fEstRef.current;
    let drift = 0;
    if (f > 12) drift = 1;
    else if (f < 9) drift = -1;
    const magnitude = 0.002 * Math.abs(f - 10.5) / 9.5 * F_prev;
    fEstRef.current = F_prev + drift * magnitude;
  }
  const fEst = fEstRef.current;

  // 1. Momentum signal: avg of bands 0-2, mapped to -1..+1
  const avgBands02 = (bandMeans[0] + bandMeans[1] + bandMeans[2]) / 3;
  const momentumSignal = Math.max(-1, Math.min(1, (avgBands02 - 10.5) / 9.5));

  // 2. Value signal: gap from F_t, mapped to -1..+1
  const gap = price > 0 ? (fEst - price) / price : 0;
  const valueSignal = Math.max(-1, Math.min(1, gap * 10)); // scale up

  // 3. Sentiment signal: mapped to -1..+1
  const sentimentSignal = (sentiment - 0.5) * 2;

  // 4. Volatility signal: inverse kappa mapped to -1..+1 (low vol = bullish)
  const volSignal = Math.max(-1, Math.min(1, 1 - kappa / 2.5));

  // 5. Flow signal
  const totalVol = buyVolume + sellVolume;
  const flowSignal = totalVol > 0 ? (buyVolume - sellVolume) / totalVol : 0;

  // Composite edge score: weighted average
  const weights = { momentum: 0.25, value: 0.2, sentiment: 0.2, volatility: 0.15, flow: 0.2 };
  const edgeScore =
    momentumSignal * weights.momentum +
    valueSignal * weights.value +
    sentimentSignal * weights.sentiment +
    volSignal * weights.volatility +
    flowSignal * weights.flow;

  const edgeClamped = Math.max(-1, Math.min(1, edgeScore));

  // Confidence: based on alignment of signals
  const signals = [momentumSignal, valueSignal, sentimentSignal, volSignal, flowSignal];
  const signCount = signals.filter((s) => Math.sign(s) === Math.sign(edgeClamped)).length;
  const confidence = signCount / signals.length;

  // Risk level based on kappa
  const riskLevel = kappa < 1.0 ? 'Low' : kappa < 2.0 ? 'Medium' : kappa < 3.0 ? 'High' : 'Extreme';
  const riskColor = kappa < 1.0 ? '#22c55e' : kappa < 2.0 ? '#eab308' : kappa < 3.0 ? '#f97316' : '#ef4444';

  const edgeColor = edgeClamped > 0.1 ? '#22c55e' : edgeClamped < -0.1 ? '#ef4444' : '#eab308';
  const edgeLabel = edgeClamped > 0.3 ? 'Strong Bullish' : edgeClamped > 0.1 ? 'Bullish' :
    edgeClamped < -0.3 ? 'Strong Bearish' : edgeClamped < -0.1 ? 'Bearish' : 'Neutral';

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Signal Dashboard</h3>

      {/* Edge score */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold" style={{ color: edgeColor }}>
            {(edgeClamped * 100).toFixed(0)}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: edgeColor + '20', color: edgeColor }}>
          {edgeLabel}
        </span>
      </div>

      {/* Edge score bar */}
      <div className="mb-3">
        <div className="w-full h-2 bg-gray-800 rounded-full relative overflow-hidden">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
          <div
            className="absolute top-0 h-full rounded-full transition-all duration-300"
            style={{
              left: edgeClamped >= 0 ? '50%' : `${50 + edgeClamped * 50}%`,
              width: `${Math.abs(edgeClamped) * 50}%`,
              backgroundColor: edgeColor,
            }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>

      {/* Confidence and Risk */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 bg-gray-900/50 rounded px-2 py-1.5">
          <span className="text-[10px] text-gray-500 block">Confidence</span>
          <span className="text-sm font-bold text-gray-200">{(confidence * 100).toFixed(0)}%</span>
          <span className="text-[10px] text-gray-500 ml-1">({signCount}/{signals.length} aligned)</span>
        </div>
        <div className="flex-1 bg-gray-900/50 rounded px-2 py-1.5">
          <span className="text-[10px] text-gray-500 block">Risk Level</span>
          <span className="text-sm font-bold" style={{ color: riskColor }}>{riskLevel}</span>
          <span className="text-[10px] text-gray-500 ml-1">(k={kappa.toFixed(2)})</span>
        </div>
      </div>

      {/* Factor breakdown */}
      <div className="mb-1">
        <span className="text-[10px] text-gray-500">Factor Breakdown</span>
      </div>
      <SignalBar label="Momentum" value={momentumSignal} color={momentumSignal >= 0 ? '#22c55e' : '#ef4444'} />
      <SignalBar label="Value" value={valueSignal} color={valueSignal >= 0 ? '#22c55e' : '#ef4444'} />
      <SignalBar label="Sentiment" value={sentimentSignal} color={sentimentSignal >= 0 ? '#22c55e' : '#ef4444'} />
      <SignalBar label="Volatility" value={volSignal} color={volSignal >= 0 ? '#22c55e' : '#ef4444'} />
      <SignalBar label="Flow" value={flowSignal} color={flowSignal >= 0 ? '#22c55e' : '#ef4444'} />
    </div>
  );
}
