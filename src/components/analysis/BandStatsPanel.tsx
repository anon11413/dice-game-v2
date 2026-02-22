import { useDiceStore } from '../../store/diceStore';

const BAND_NAMES = [
  'Band 1: Scalpers',
  'Band 2: Swing',
  'Band 3: Position',
  'Band 4: Value',
  'Band 5: Shorts',
  'Band 6: MMs',
  'Band 7: Volatility',
  'Band 8: Events',
  'Band 9: Sentiment',
  'Band 10: Regime',
];

function getMeanColor(mean: number): string {
  if (mean >= 15) return 'bg-red-500';
  if (mean >= 12) return 'bg-orange-400';
  if (mean >= 9) return 'bg-gray-400';
  if (mean >= 6) return 'bg-cyan-400';
  return 'bg-blue-500';
}

export function BandStatsPanel() {
  const { bandMeans, bandStds } = useDiceStore();

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">Band Statistics</h3>
      <div className="space-y-1.5">
        {BAND_NAMES.map((name, i) => {
          const mean = bandMeans[i];
          const std = bandStds[i];
          const pct = ((mean - 1) / 19) * 100;

          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-28 truncate">{name}</span>
              <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${getMeanColor(mean)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right">
                {mean.toFixed(1)}
              </span>
              <span className="text-[10px] text-gray-600 tabular-nums w-10 text-right">
                ±{std.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
