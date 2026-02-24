import { useMemo } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { useDiceStore } from '../../../store/diceStore';
import { RESOLUTIONS } from '../../../engine/constants';

type Direction = 'up' | 'down' | 'flat';

function useDirection(): { direction: Direction; changeOverWindow: number } {
  const candles = useMarketStore((s) => s.candles);
  const tenMinCandles = candles.get(RESOLUTIONS.TEN_MIN);

  return useMemo(() => {
    if (!tenMinCandles || tenMinCandles.length < 2) {
      return { direction: 'flat', changeOverWindow: 0 };
    }
    // Use last candle for 10-minute momentum
    const prev = tenMinCandles[tenMinCandles.length - 2];
    const curr = tenMinCandles[tenMinCandles.length - 1];
    const startPrice = prev.open;
    const endPrice = curr.close;
    const change = endPrice - startPrice;
    const pct = startPrice !== 0 ? (change / startPrice) * 100 : 0;

    if (pct > 0.1) return { direction: 'up', changeOverWindow: pct };
    if (pct < -0.1) return { direction: 'down', changeOverWindow: pct };
    return { direction: 'flat', changeOverWindow: pct };
  }, [tenMinCandles]);
}

const dirConfig = {
  up: {
    rotation: '-rotate-0',
    color: '#22c55e',
    bgGlow: 'shadow-green-500/20',
    label: 'Bullish',
    labelClass: 'text-green-400',
    arrow: 'M24 38V10M24 10L12 22M24 10L36 22',
  },
  down: {
    rotation: 'rotate-180',
    color: '#ef4444',
    bgGlow: 'shadow-red-500/20',
    label: 'Bearish',
    labelClass: 'text-red-400',
    arrow: 'M24 38V10M24 10L12 22M24 10L36 22',
  },
  flat: {
    rotation: 'rotate-90',
    color: '#eab308',
    bgGlow: 'shadow-yellow-500/20',
    label: 'Neutral',
    labelClass: 'text-yellow-400',
    arrow: 'M10 24H38M38 24L26 12M38 24L26 36',
  },
};

export function MomentumArrow() {
  const { direction, changeOverWindow } = useDirection();
  const scalperMean = useDiceStore((s) => s.bandMeans[0]);
  const cfg = dirConfig[direction];

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800 flex flex-col items-center justify-center gap-2">
      <h3 className="text-sm font-medium text-gray-300">Momentum</h3>

      {/* Animated arrow */}
      <div className={`relative shadow-lg ${cfg.bgGlow} rounded-full`}>
        <svg
          width="80"
          height="80"
          viewBox="0 0 48 48"
          className={`${direction === 'down' ? 'rotate-180' : direction === 'flat' ? '' : ''} animate-pulse`}
          style={{ filter: `drop-shadow(0 0 8px ${cfg.color}40)` }}
        >
          {direction === 'flat' ? (
            <path
              d="M10 24H38M38 24L26 12M38 24L26 36"
              stroke={cfg.color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : (
            <path
              d={`M24 38V10M24 10L12 22M24 10L36 22`}
              stroke={cfg.color}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              transform={direction === 'down' ? 'rotate(180 24 24)' : ''}
            />
          )}
        </svg>
      </div>

      {/* Label */}
      <span className={`text-lg font-bold ${cfg.labelClass}`}>
        {cfg.label}
      </span>

      {/* Details */}
      <div className="flex flex-col items-center gap-0.5 text-xs text-gray-400">
        <span>
          10 min: <span className={changeOverWindow >= 0 ? 'text-green-400' : 'text-red-400'}>
            {changeOverWindow >= 0 ? '+' : ''}{changeOverWindow.toFixed(2)}%
          </span>
        </span>
        <span>
          Scalper: <span className="text-gray-300">{scalperMean.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}
