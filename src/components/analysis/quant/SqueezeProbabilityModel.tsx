import { useRef, useEffect } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { useDiceStore } from '../../../store/diceStore';
import { useAnalysisStore } from '../../../store/analysisStore';
import { DEFAULT_CONFIG, RESOLUTIONS } from '../../../engine/constants';

/** Piecewise kappa estimation (same as KappaEstimator) */
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

function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mb-1.5">
      <div className="flex justify-between items-center mb-0.5">
        <span className="text-[10px] text-gray-400">{label}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function SqueezeProbabilityModel() {
  const utilization = useMarketStore((s) => s.utilization);
  const price = useMarketStore((s) => s.price);
  const candles = useMarketStore((s) => s.candles);
  const bandMeans = useDiceStore((s) => s.bandMeans);
  const bandStds = useDiceStore((s) => s.bandStds);
  const revealEnabled = useAnalysisStore((s) => s.revealEnabled);
  const revealData = useAnalysisStore((s) => s.revealData);

  const smoothedKappaRef = useRef(1.0);
  const smoothedSentRef = useRef(0.5);

  // Estimate kappa
  const rawKappa = estimateKappaRaw(bandMeans[6], bandStds[6]);
  smoothedKappaRef.current = 0.7 * smoothedKappaRef.current + 0.3 * rawKappa;
  const kappa = Math.max(0.2, Math.min(5.0, smoothedKappaRef.current));

  // Estimate sentiment
  const sNorm = (bandMeans[8] - 1) / 19;
  smoothedSentRef.current = 0.92 * smoothedSentRef.current + 0.08 * sNorm;
  const sentiment = Math.max(0, Math.min(1, smoothedSentRef.current));

  // 1. Utilization condition: utilization / 0.45
  const utilPct = (utilization / DEFAULT_CONFIG.SQUEEZE_UTIL_THRESH) * 100;

  // 2. Price momentum: detect 3% move in last 20 ticks
  let priceMomentumPct = 0;
  const tickCandles = candles.get(RESOLUTIONS.ONE_SEC);
  if (tickCandles && tickCandles.length >= 20) {
    const recent = tickCandles.slice(-20);
    const startPrice = recent[0].close;
    const endPrice = recent[recent.length - 1].close;
    const move = Math.abs(endPrice - startPrice) / startPrice;
    priceMomentumPct = (move / DEFAULT_CONFIG.SQUEEZE_PRICE_THRESH) * 100;
  } else if (price > 0) {
    // Fallback: rough estimate from recent price
    priceMomentumPct = 0;
  }

  // 3. Sentiment extreme: |sentiment - 0.5| / 0.4
  const sentimentExtremePct = (Math.abs(sentiment - 0.5) / 0.4) * 100;

  // 4. Kappa elevated: kappa / 3.0
  const kappaElevatedPct = (kappa / 3.0) * 100;

  // Composite: weighted average
  const composite = utilPct * 0.35 + priceMomentumPct * 0.25 + sentimentExtremePct * 0.2 + kappaElevatedPct * 0.2;
  const compositeClamped = Math.max(0, Math.min(100, composite));

  const compositeColor = compositeClamped >= 75 ? '#ef4444' : compositeClamped >= 50 ? '#f97316' : compositeClamped >= 25 ? '#eab308' : '#22c55e';

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-300">Squeeze Probability</h3>
        {revealEnabled && revealData && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            revealData.squeeze_active
              ? 'bg-red-500/20 text-red-400'
              : 'bg-gray-700 text-gray-400'
          }`}>
            {revealData.squeeze_active ? 'SQUEEZE ACTIVE' : 'No Squeeze'}
          </span>
        )}
      </div>

      {/* Composite score */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl font-bold" style={{ color: compositeColor }}>
          {compositeClamped.toFixed(0)}%
        </span>
        <span className="text-xs text-gray-400">composite probability</span>
      </div>

      {/* Individual conditions */}
      <ProgressBar
        label={`Utilization (${(utilization * 100).toFixed(1)}% / ${(DEFAULT_CONFIG.SQUEEZE_UTIL_THRESH * 100).toFixed(0)}%)`}
        value={utilPct}
        color={utilPct >= 100 ? '#ef4444' : '#3b82f6'}
      />
      <ProgressBar
        label="Price Momentum (3% in 20 ticks)"
        value={priceMomentumPct}
        color={priceMomentumPct >= 100 ? '#ef4444' : '#3b82f6'}
      />
      <ProgressBar
        label={`Sentiment Extreme (|${(sentiment * 100).toFixed(0)} - 50| / 40)`}
        value={sentimentExtremePct}
        color={sentimentExtremePct >= 100 ? '#ef4444' : '#3b82f6'}
      />
      <ProgressBar
        label={`Kappa Elevated (${kappa.toFixed(2)} / 3.0)`}
        value={kappaElevatedPct}
        color={kappaElevatedPct >= 100 ? '#ef4444' : '#3b82f6'}
      />
    </div>
  );
}
