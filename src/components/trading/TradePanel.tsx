import { useState } from 'react';
import { useMarketStore } from '../../store/marketStore';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';

const BASE_PRICE = 100;

export function TradePanel() {
  const [activeAsset, setActiveAsset] = useState<'A' | 'B'>('A');
  const [quantity, setQuantity] = useState('');
  const priceA = useMarketStore((s) => s.price);
  const priceB = Math.max(0.01, 2 * BASE_PRICE - priceA);

  const { user, isGuest } = useAuthStore();
  const {
    guestCash, guestSharesA, guestSharesB,
    guestAvgEntryA, guestAvgEntryB,
    executeTrade, isTrading, tradeError, clearTradeError,
  } = usePlayerStore();

  const price = activeAsset === 'A' ? priceA : priceB;
  const cash = isGuest ? guestCash : (user?.cash ?? 0);
  const shares = isGuest
    ? (activeAsset === 'A' ? guestSharesA : guestSharesB)
    : (activeAsset === 'A' ? (user?.sharesA ?? 0) : (user?.sharesB ?? 0));
  const avgEntry = isGuest
    ? (activeAsset === 'A' ? guestAvgEntryA : guestAvgEntryB)
    : (activeAsset === 'A' ? (user?.avgEntryA ?? 0) : (user?.avgEntryB ?? 0));

  const unrealizedPnl = shares > 0 ? (price - avgEntry) * shares : 0;
  const unrealizedPnlPct = avgEntry > 0 ? ((price - avgEntry) / avgEntry) * 100 : 0;
  const qty = parseInt(quantity) || 0;
  const totalCost = qty * price;

  const handleTrade = async (side: 'BUY' | 'SELL') => {
    if (qty <= 0) return;
    clearTradeError();
    await executeTrade(activeAsset, side, qty, priceA);
    setQuantity('');
  };

  const maxBuyable = price > 0 ? Math.floor(cash / price) : 0;

  return (
    <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
      {/* Cash Balance */}
      <div className="text-center pb-3 border-b border-gray-800">
        <span className="text-gray-400 text-sm">Cash Balance</span>
        <div className="text-xl font-bold text-white tabular-nums">${cash.toFixed(2)}</div>
      </div>

      {/* Asset Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        <button
          onClick={() => setActiveAsset('A')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeAsset === 'A'
              ? 'bg-blue-600 text-white'
              : 'bg-[#161b22] text-gray-400 hover:text-white'
          }`}
        >
          Stock A
        </button>
        <button
          onClick={() => setActiveAsset('B')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeAsset === 'B'
              ? 'bg-purple-600 text-white'
              : 'bg-[#161b22] text-gray-400 hover:text-white'
          }`}
        >
          Stock B
        </button>
      </div>

      {/* Price Display */}
      <div className="text-center">
        <div className="text-2xl font-bold text-white tabular-nums">
          ${price.toFixed(2)}
        </div>
        <div className="text-xs text-gray-500">
          {activeAsset === 'B' ? 'Inverse of Stock A' : 'Dice Engine Price'}
        </div>
      </div>

      {/* Position Info */}
      {shares > 0 && (
        <div className="bg-[#161b22] rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Shares</span>
            <span className="text-white tabular-nums">{shares}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Avg Entry</span>
            <span className="text-white tabular-nums">${avgEntry.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">P&L</span>
            <span className={`tabular-nums font-medium ${unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)} ({unrealizedPnlPct >= 0 ? '+' : ''}{unrealizedPnlPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}

      {/* Quantity Input */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number"
            value={quantity}
            onChange={(e) => { setQuantity(e.target.value); clearTradeError(); }}
            className="flex-1 bg-[#161b22] border border-gray-700 rounded-lg px-3 py-2.5 text-white tabular-nums focus:outline-none focus:border-blue-500"
            placeholder="Quantity"
            min="1"
            inputMode="numeric"
          />
        </div>
        <div className="flex gap-2 mb-2">
          {[10, 25, 50, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setQuantity(String(Math.floor(maxBuyable * pct / 100)))}
              className="flex-1 text-xs py-1 bg-[#161b22] border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>
        {qty > 0 && (
          <p className="text-xs text-gray-500 text-center">
            Total: ${totalCost.toFixed(2)}
          </p>
        )}
      </div>

      {/* Error */}
      {tradeError && (
        <p className="text-red-400 text-sm text-center">{tradeError}</p>
      )}

      {/* Buy/Sell Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => handleTrade('BUY')}
          disabled={isTrading || qty <= 0 || totalCost > cash}
          className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-colors min-h-[44px]"
        >
          {isTrading ? '...' : 'BUY'}
        </button>
        <button
          onClick={() => handleTrade('SELL')}
          disabled={isTrading || qty <= 0 || qty > shares}
          className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-colors min-h-[44px]"
        >
          {isTrading ? '...' : 'SELL'}
        </button>
      </div>
    </div>
  );
}
