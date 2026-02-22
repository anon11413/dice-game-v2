import { useMemo } from 'react';
import { useDiceStore } from '../../../store/diceStore';
import { useAnalysisStore } from '../../../store/analysisStore';

type Signal = 'green' | 'yellow' | 'red';

interface Category {
  name: string;
  signal: Signal;
  description: string;
}

const DOT_COLORS: Record<Signal, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const DESC_COLORS: Record<Signal, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

export function WhatTheDiceSay() {
  const bandMeans = useDiceStore((s) => s.bandMeans);
  const latestColMeans = useAnalysisStore((s) => s.latestColMeans);

  const categories: Category[] = useMemo(() => {
    // Traders: bands 0-2 avg
    const tradersAvg = (bandMeans[0] + bandMeans[1] + bandMeans[2]) / 3;
    const tradersSignal: Signal =
      tradersAvg > 12 ? 'green' : tradersAvg < 9 ? 'red' : 'yellow';
    const tradersDesc =
      tradersAvg > 12
        ? `Traders bullish (avg ${tradersAvg.toFixed(1)})`
        : tradersAvg < 9
          ? `Traders bearish (avg ${tradersAvg.toFixed(1)})`
          : `Traders mixed (avg ${tradersAvg.toFixed(1)})`;

    // Shorts: band 4
    const shortsMean = bandMeans[4];
    const shortsSignal: Signal =
      shortsMean < 9 ? 'green' : shortsMean > 12 ? 'red' : 'yellow';
    const shortsDesc =
      shortsMean < 9
        ? `Low short activity (${shortsMean.toFixed(1)})`
        : shortsMean > 12
          ? `Heavy shorting (${shortsMean.toFixed(1)})`
          : `Moderate short activity (${shortsMean.toFixed(1)})`;

    // Mood: band 8
    const moodMean = bandMeans[8];
    const moodSignal: Signal =
      moodMean > 13 ? 'green' : moodMean < 8 ? 'red' : 'yellow';
    const moodDesc =
      moodMean > 13
        ? `Optimistic mood (${moodMean.toFixed(1)})`
        : moodMean < 8
          ? `Fearful mood (${moodMean.toFixed(1)})`
          : `Neutral mood (${moodMean.toFixed(1)})`;

    // Volatility: band 6
    const volMean = bandMeans[6];
    const volSignal: Signal =
      volMean < 10 ? 'green' : volMean > 15 ? 'red' : 'yellow';
    const volDesc =
      volMean < 10
        ? `Calm market (${volMean.toFixed(1)})`
        : volMean > 15
          ? `Wild volatility (${volMean.toFixed(1)})`
          : `Moderate volatility (${volMean.toFixed(1)})`;

    // Events: band 7 colMeans
    let eventSignal: Signal = 'green';
    let eventDesc = 'No events brewing';
    if (latestColMeans && latestColMeans[7]) {
      const colMeans7 = latestColMeans[7];
      const hasExtreme = colMeans7.some((v) => v > 16.5 || v < 4.5);
      const hasMild = colMeans7.some((v) => v > 15 || v < 6);
      const allSafe = colMeans7.every((v) => v >= 6 && v <= 15);

      if (hasExtreme) {
        eventSignal = 'red';
        eventDesc = 'Event likely! Extreme dice activity';
      } else if (!allSafe && hasMild) {
        eventSignal = 'yellow';
        eventDesc = 'Some unusual dice activity';
      } else {
        eventSignal = 'green';
        eventDesc = 'All dice in normal range';
      }
    }

    return [
      { name: 'Traders', signal: tradersSignal, description: tradersDesc },
      { name: 'Shorts', signal: shortsSignal, description: shortsDesc },
      { name: 'Mood', signal: moodSignal, description: moodDesc },
      { name: 'Volatility', signal: volSignal, description: volDesc },
      { name: 'Events', signal: eventSignal, description: eventDesc },
    ];
  }, [bandMeans, latestColMeans]);

  return (
    <div className="bg-[#0d1117] rounded-lg p-3 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-2">What the Dice Say</h3>
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.name} className="flex items-center gap-3">
            {/* Traffic light dot */}
            <span
              className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${DOT_COLORS[cat.signal]}`}
              style={{
                boxShadow:
                  cat.signal === 'green'
                    ? '0 0 6px rgba(34,197,94,0.5)'
                    : cat.signal === 'red'
                      ? '0 0 6px rgba(239,68,68,0.5)'
                      : '0 0 6px rgba(234,179,8,0.4)',
              }}
            />
            {/* Category name */}
            <span className="text-sm font-medium text-gray-300 w-20">{cat.name}</span>
            {/* Description */}
            <span className={`text-xs ${DESC_COLORS[cat.signal]}`}>
              {cat.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
