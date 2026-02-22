import { useMarketStore } from '../../store/marketStore';
import { formatPrice, formatChange, formatPct, formatVolume } from '../../utils/format';

export function TickerBar() {
  const { price, priceChange, priceChangePct, volume, bestBid, bestAsk, spread } = useMarketStore();

  const isPositive = priceChange >= 0;
  const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-[#0d1117] border-b border-gray-800">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-white tabular-nums">{formatPrice(price)}</span>
        <span className={`text-sm font-medium tabular-nums ${changeColor}`}>
          {formatChange(priceChange)} ({formatPct(priceChangePct)})
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div>
          <span className="text-gray-500">Vol </span>
          <span className="tabular-nums">{formatVolume(volume)}</span>
        </div>
        <div>
          <span className="text-gray-500">Bid </span>
          <span className="tabular-nums text-emerald-400">{bestBid !== null ? bestBid.toFixed(2) : '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Ask </span>
          <span className="tabular-nums text-red-400">{bestAsk !== null ? bestAsk.toFixed(2) : '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Spread </span>
          <span className="tabular-nums">{spread !== null ? spread.toFixed(2) : '—'}</span>
        </div>
      </div>
    </div>
  );
}
