import { useMarketStore } from '../../../store/marketStore';

type SqueezeLevel = 'none' | 'watch' | 'warning' | 'alert';

function getSqueezeLevel(utilization: number): SqueezeLevel {
  if (utilization > 0.50) return 'alert';
  if (utilization > 0.40) return 'warning';
  if (utilization > 0.30) return 'watch';
  return 'none';
}

const LEVEL_CONFIG = {
  watch: {
    label: 'Squeeze Watch',
    color: '#eab308',
    bgClass: 'border-yellow-800/50',
    textClass: 'text-yellow-400',
    barClass: 'bg-yellow-500',
    animClass: 'animate-pulse',
    animDuration: '2s',
  },
  warning: {
    label: 'Squeeze Warning',
    color: '#f97316',
    bgClass: 'border-orange-800/50',
    textClass: 'text-orange-400',
    barClass: 'bg-orange-500',
    animClass: 'animate-pulse',
    animDuration: '1s',
  },
  alert: {
    label: 'SQUEEZE ALERT',
    color: '#ef4444',
    bgClass: 'border-red-800/50',
    textClass: 'text-red-400',
    barClass: 'bg-red-500',
    animClass: 'animate-pulse',
    animDuration: '0.5s',
  },
} as const;

export function SqueezeAlert() {
  const utilization = useMarketStore((s) => s.utilization);
  const shortInterest = useMarketStore((s) => s.shortInterest);

  const level = getSqueezeLevel(utilization);

  if (level === 'none') {
    return (
      <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Short Squeeze</h3>
        <div className="flex flex-col items-center justify-center py-4 gap-1">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-green-500">
            <path
              d="M9 12L11 14L15 10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-xs text-gray-500">No squeeze risk</span>
          <span className="text-xs text-gray-600 tabular-nums">
            Utilization: {(utilization * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    );
  }

  const cfg = LEVEL_CONFIG[level];
  const barPct = Math.min(100, (utilization / 0.6) * 100);

  return (
    <div
      className={`bg-[#0d1117] rounded-lg p-3 border ${cfg.bgClass}`}
      style={{ borderColor: `${cfg.color}40` }}
    >
      <h3 className="text-sm font-medium text-gray-300 mb-2">Short Squeeze</h3>

      {/* Alert header */}
      <div
        className={cfg.animClass}
        style={{ animationDuration: cfg.animDuration }}
      >
        <div className={`text-center text-lg font-bold ${cfg.textClass} mb-2`}>
          {cfg.label}
        </div>
      </div>

      {/* Pressure bar */}
      <div className="mb-2">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Pressure</span>
          <span className={cfg.textClass}>{(utilization * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.barClass}`}
            style={{
              width: `${barPct}%`,
              boxShadow: `0 0 8px ${cfg.color}60`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>0%</span>
          <span>30%</span>
          <span>40%</span>
          <span>50%</span>
          <span>60%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs">
        <div className="text-gray-400">
          Short Interest: <span className="text-gray-300 tabular-nums">{shortInterest.toLocaleString()}</span>
        </div>
        <div className="text-gray-400">
          Util: <span className={`${cfg.textClass} tabular-nums`}>{(utilization * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
