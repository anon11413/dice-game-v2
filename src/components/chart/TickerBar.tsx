import { useMarketStore } from '../../store/marketStore';
import { formatPrice, formatChange, formatPct, formatVolume } from '../../utils/format';

const BASE_PRICE = 100;

export function TickerBar() {
  const { price, priceChange, priceChangePct, volume, bestBid, bestAsk, spread } = useMarketStore();

  const priceB = Math.max(0.01, 2 * BASE_PRICE - price);
  const isPositive = priceChange >= 0;
  const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-3 sm:gap-6 px-3 sm:px-4 py-2 bg-[#0d1117] border-b border-gray-800 overflow-x-auto">
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-xs text-blue-400 font-medium">A</span>
        <span className="text-xl font-bold text-white tabular-nums">{formatPrice(price)}</span>
        <span className={`text-sm font-medium tabular-nums ${changeColor}`}>
          {formatChange(priceChange)} ({formatPct(priceChangePct)})
        </span>
      </div>

      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-xs text-purple-400 font-medium">B</span>
        <span className="text-sm font-bold text-white tabular-nums">{formatPrice(priceB)}</span>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 text-xs text-gray-400 shrink-0">
        <div>
          <span className="text-gray-500">Vol </span>
          <span className="tabular-nums">{formatVolume(volume)}</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-gray-500">Bid </span>
          <span className="tabular-nums text-emerald-400">{bestBid !== null ? bestBid.toFixed(2) : '—'}</span>
        </div>
        <div className="hidden sm:block">
          <span className="text-gray-500">Ask </span>
          <span className="tabular-nums text-red-400">{bestAsk !== null ? bestAsk.toFixed(2) : '—'}</span>
        </div>
        <div className="hidden md:block">
          <span className="text-gray-500">Spread </span>
          <span className="tabular-nums">{spread !== null ? spread.toFixed(2) : '—'}</span>
        </div>
      </div>
    </div>
  );
}
