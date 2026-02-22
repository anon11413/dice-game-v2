import { create } from 'zustand';

interface DiceState {
  grid: Uint8Array | null;
  bandMeans: number[];
  bandStds: number[];
  bandMeansHistory: number[][];   // [bandIndex][tick] — last 200 values per band

  updateDice: (grid: Uint8Array, means: number[], stds: number[]) => void;
}

const MAX_HISTORY = 200;

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
