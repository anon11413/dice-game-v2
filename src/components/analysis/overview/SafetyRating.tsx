import { useMemo } from 'react';
import { useMarketStore } from '../../../store/marketStore';
import { useDiceStore } from '../../../store/diceStore';
import { useAnalysisStore } from '../../../store/analysisStore';

interface Risk {
  id: string;
  label: string;
  active: boolean;
  description: string;
}

function ShieldIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 6V11C4 16.52 7.42 21.74 12 23C16.58 21.74 20 16.52 20 11V6L12 2Z"
        fill={filled ? '#22c55e' : 'none'}
        stroke={filled ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity={filled ? 0.9 : 0.6}
      />
      {filled ? (
        <path
          d="M9 12L11 14L15 10"
          stroke="#0d1117"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <line x1="10" y1="10" x2="14" y2="14" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="10" x2="10" y2="14" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

export function SafetyRating() {
  const bandMeans = useDiceStore((s) => s.bandMeans);
  const spread = useMarketStore((s) => s.spread);
  const utilization = useMarketStore((s) => s.utilization);
  const priceChangePct = useMarketStore((s) => s.priceChangePct);
  const latestColMeans = useAnalysisStore((s) => s.latestColMeans);

  const risks: Risk[] = useMemo(() => {
    // Check event brewing: band 7 (index 7) colMeans
    let eventBrewing = false;
    if (latestColMeans && latestColMeans[7]) {
      eventBrewing = latestColMeans[7].some((v) => v > 16 || v < 5);
    }

    return [
      {
        id: 'volatility',
        label: 'Volatility',
        active: bandMeans[6] > 15,
        description: bandMeans[6] > 15
          ? `High volatility (${bandMeans[6].toFixed(1)})`
          : 'Volatility normal',
      },
      {
        id: 'spread',
        label: 'Spread',
        active: spread !== null && spread > 0.5,
        description: spread !== null && spread > 0.5
          ? `Wide spread ($${spread.toFixed(2)})`
          : 'Spread tight',
      },
      {
        id: 'event',
        label: 'Event',
        active: eventBrewing,
        description: eventBrewing
          ? 'Event brewing in dice'
          : 'No events detected',
      },
      {
        id: 'squeeze',
        label: 'Squeeze',
        active: utilization > 0.30,
        description: utilization > 0.30
          ? `Squeeze risk (${(utilization * 100).toFixed(0)}% util)`
          : 'Short utilization safe',
      },
      {
        id: 'momentum',
        label: 'Price Move',
        active: Math.abs(priceChangePct) > 2,
        description: Math.abs(priceChangePct) > 2
          ? `Fast move (${priceChangePct > 0 ? '+' : ''}${priceChangePct.toFixed(1)}%)`
          : 'Price stable',
      },
    ];
  }, [bandMeans, spread, utilization, priceChangePct, latestColMeans]);

  const safeCount = 5 - risks.filter((r) => r.active).length;

  const ratingColor =
    safeCount >= 4 ? 'text-green-400' : safeCount >= 3 ? 'text-yellow-400' : 'text-red-400';
  const ratingLabel =
    safeCount >= 4 ? 'Safe' : safeCount >= 3 ? 'Caution' : safeCount >= 2 ? 'Risky' : 'Danger';

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Safety Rating</h3>

      {/* Shields */}
      <div className="flex items-center justify-center gap-1 mb-2">
        {risks.map((risk, i) => (
          <ShieldIcon key={risk.id} filled={!risk.active} />
        ))}
      </div>

      {/* Rating label */}
      <div className={`text-center text-lg font-bold ${ratingColor} mb-2`}>
        {safeCount}/5 {ratingLabel}
      </div>

      {/* Risk descriptions */}
      <div className="space-y-1">
        {risks.map((risk) => (
          <div key={risk.id} className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                risk.active ? 'bg-red-500' : 'bg-green-500'
              }`}
            />
            <span className={risk.active ? 'text-red-400' : 'text-gray-500'}>
              {risk.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
