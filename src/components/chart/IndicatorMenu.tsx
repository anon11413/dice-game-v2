import { useState } from 'react';
import { useIndicatorStore } from '../../store/indicatorStore';

const INDICATOR_LABELS: Record<string, string> = {
  volume: 'Volume',
  rsi: 'RSI (14)',
  macd: 'MACD',
  bollingerBands: 'Bollinger Bands',
  sma20: 'SMA 20',
  sma50: 'SMA 50',
  sma200: 'SMA 200',
  ema20: 'EMA 20',
  ttmSqueeze: 'TTM Squeeze',
  vwap: 'VWAP',
};

export function IndicatorMenu() {
  const [open, setOpen] = useState(false);
  const { enabled, toggle } = useIndicatorStore();

  const activeCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2 py-1 text-xs font-medium rounded bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
      >
        Indicators ({activeCount})
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[#161b22] border border-gray-700 rounded-lg shadow-xl py-1">
            {Object.entries(INDICATOR_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggle(key as keyof typeof enabled)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-800 transition-colors"
              >
                <span
                  className={`w-3 h-3 rounded-sm border ${
                    enabled[key as keyof typeof enabled]
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-600'
                  }`}
                />
                <span className={enabled[key as keyof typeof enabled] ? 'text-gray-200' : 'text-gray-400'}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
