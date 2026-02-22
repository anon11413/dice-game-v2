import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import { useMarketStore } from '../../store/marketStore';

const BASE_PRICE = 100;

export function PortfolioPage() {
  const { user, isGuest } = useAuthStore();
  const {
    guestCash, guestSharesA, guestSharesB,
    guestAvgEntryA, guestAvgEntryB,
    guestTrades,
    tradeHistory, loadTradeHistory,
  } = usePlayerStore();
  const priceA = useMarketStore((s) => s.price);
  const priceB = Math.max(0.01, 2 * BASE_PRICE - priceA);

  useEffect(() => {
    loadTradeHistory();
  }, [loadTradeHistory]);

  const cash = isGuest ? guestCash : (user?.cash ?? 0);
  const sharesA = isGuest ? guestSharesA : (user?.sharesA ?? 0);
  const sharesB = isGuest ? guestSharesB : (user?.sharesB ?? 0);
  const avgEntryA = isGuest ? guestAvgEntryA : (user?.avgEntryA ?? 0);
  const avgEntryB = isGuest ? guestAvgEntryB : (user?.avgEntryB ?? 0);

  const pnlA = sharesA > 0 ? (priceA - avgEntryA) * sharesA : 0;
  const pnlB = sharesB > 0 ? (priceB - avgEntryB) * sharesB : 0;
  const pnlPctA = avgEntryA > 0 ? ((priceA - avgEntryA) / avgEntryA) * 100 : 0;
  const pnlPctB = avgEntryB > 0 ? ((priceB - avgEntryB) / avgEntryB) * 100 : 0;

  const totalValue = cash + (sharesA * priceA) + (sharesB * priceB);
  const totalPnl = totalValue - 100; // Starting cash was $100

  const trades = isGuest ? guestTrades : tradeHistory;

  return (
    <div className="p-2 sm:p-4 max-w-4xl mx-auto space-y-4">
      {/* Portfolio Summary */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-3">Portfolio</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-gray-500 text-xs">Total Value</span>
            <div className="text-xl font-bold text-white tabular-nums">${totalValue.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Total P&L</span>
            <div className={`text-xl font-bold tabular-nums ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Cash</span>
            <div className="text-xl font-bold text-white tabular-nums">${cash.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Return</span>
            <div className={`text-xl font-bold tabular-nums ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{((totalPnl / 100) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-3">Holdings</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2 pr-4">Asset</th>
                <th className="text-right py-2 px-2">Shares</th>
                <th className="text-right py-2 px-2">Avg Entry</th>
                <th className="text-right py-2 px-2">Price</th>
                <th className="text-right py-2 px-2">Value</th>
                <th className="text-right py-2 pl-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {sharesA > 0 && (
                <tr className="border-b border-gray-800/50">
                  <td className="py-2.5 pr-4 font-medium text-blue-400">Stock A</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-white">{sharesA}</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-gray-300">${avgEntryA.toFixed(2)}</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-white">${priceA.toFixed(2)}</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-white">${(sharesA * priceA).toFixed(2)}</td>
                  <td className={`text-right py-2.5 pl-2 tabular-nums font-medium ${pnlA >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlA >= 0 ? '+' : ''}${pnlA.toFixed(2)} ({pnlPctA >= 0 ? '+' : ''}{pnlPctA.toFixed(1)}%)
                  </td>
                </tr>
              )}
              {sharesB > 0 && (
                <tr className="border-b border-gray-800/50">
                  <td className="py-2.5 pr-4 font-medium text-purple-400">Stock B</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-white">{sharesB}</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-gray-300">${avgEntryB.toFixed(2)}</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-white">${priceB.toFixed(2)}</td>
                  <td className="text-right py-2.5 px-2 tabular-nums text-white">${(sharesB * priceB).toFixed(2)}</td>
                  <td className={`text-right py-2.5 pl-2 tabular-nums font-medium ${pnlB >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlB >= 0 ? '+' : ''}${pnlB.toFixed(2)} ({pnlPctB >= 0 ? '+' : ''}{pnlPctB.toFixed(1)}%)
                  </td>
                </tr>
              )}
              {sharesA === 0 && sharesB === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    No holdings yet. Start trading on the Chart tab!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade History */}
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-bold text-white mb-3">Trade History</h2>
        {trades.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No trades yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4">Date</th>
                  <th className="text-left py-2 px-2">Asset</th>
                  <th className="text-left py-2 px-2">Side</th>
                  <th className="text-right py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Price</th>
                  <th className="text-right py-2 pl-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {trades.slice(0, 50).map((t) => (
                  <tr key={t.id} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 text-gray-400 tabular-nums">
                      {new Date(t.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className={`py-2 px-2 font-medium ${t.asset === 'A' ? 'text-blue-400' : 'text-purple-400'}`}>
                      Stock {t.asset}
                    </td>
                    <td className={`py-2 px-2 font-medium ${t.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.side}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums text-white">{t.quantity}</td>
                    <td className="text-right py-2 px-2 tabular-nums text-gray-300">${t.price.toFixed(2)}</td>
                    <td className="text-right py-2 pl-2 tabular-nums text-white">${t.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
