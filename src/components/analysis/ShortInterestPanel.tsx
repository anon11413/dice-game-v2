import { useMarketStore } from '../../store/marketStore';
import { formatNumber } from '../../utils/format';

export function ShortInterestPanel() {
  const { shortInterest, utilization } = useMarketStore();

  const utilPct = (utilization * 100).toFixed(2);
  const utilColor = utilization > 0.45 ? 'text-red-400' : utilization > 0.25 ? 'text-yellow-400' : 'text-emerald-400';

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">
        Short Interest
        <span className="text-[10px] text-yellow-600 ml-2">(5-tick delay)</span>
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] text-gray-500 mb-0.5">Shares Short</div>
          <div className="text-lg font-bold tabular-nums text-gray-200">
            {formatNumber(shortInterest)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-500 mb-0.5">Utilization</div>
          <div className={`text-lg font-bold tabular-nums ${utilColor}`}>
            {utilPct}%
          </div>
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mt-2">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              utilization > 0.45 ? 'bg-red-500' : utilization > 0.25 ? 'bg-yellow-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(utilization * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
          <span>0%</span>
          <span className="text-yellow-600">45% (squeeze)</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
