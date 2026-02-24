import { create } from 'zustand';

interface DiceState {
  grid: Uint8Array | null;
  bandMeans: number[];
  bandStds: number[];
  bandMeansHistory: number[][];   // [bandIndex][update] — last 10 min of values per band

  updateDice: (grid: Uint8Array, means: number[], stds: number[]) => void;
}

// 10 minutes = 3,250 ticks; analysis updates every 5 ticks → 650 entries
const MAX_HISTORY = 650;

export const useDiceStore = create<DiceState>((set, get) => ({
  grid: null,
  bandMeans: Array(10).fill(10.5),
  bandStds: Array(10).fill(5.77),
  bandMeansHistory: Array.from({ length: 10 }, () => []),

  updateDice: (grid, means, stds) => {
    const prev = get().bandMeansHistory;
    const newHistory = prev.map((hist, i) => {
      const next = [...hist, means[i]];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });

    set({
      grid,
      bandMeans: means,
      bandStds: stds,
      bandMeansHistory: newHistory,
    });
  },
}));
