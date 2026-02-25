import { create } from 'zustand';
import type { RevealData, DepthBySource } from '../engine/types';

const MAX_HISTORY = 200;
const MAX_VOLUME_HISTORY = 3_250; // 50 one-minute bars × 65 updates/min (325 ticks/min ÷ 5 ticks/update)

interface AnalysisState {
  activeTab: 'dashboard' | 'overview' | 'technical' | 'quant';

  // Extended analysis data
  latestColMeans: number[][] | null;     // 10 bands × 100 columns
  colMeansHistory: number[][][] | null;  // last 200 snapshots of [10×100]
  buyVolume: number;
  sellVolume: number;
  buyVolumeHistory: number[];
  sellVolumeHistory: number[];
  depthBySource: DepthBySource | null;
  spreadHistory: number[];

  // Fundamental price (F_t) from server
  F_t: number;
  F_tHistory: number[];

  // Reveal mode
  revealEnabled: boolean;
  revealData: RevealData | null;
  revealHistory: { F_t: number; kappa_t: number; sentiment_t: number }[];

  // Actions
  setActiveTab: (tab: AnalysisState['activeTab']) => void;
  updateExtended: (data: {
    colMeans: number[][];
    buyVolume: number;
    sellVolume: number;
    depthBySource: DepthBySource;
    F_t?: number;
  }) => void;
  updateReveal: (data: RevealData) => void;
  setRevealEnabled: (enabled: boolean) => void;
  addSpread: (spread: number) => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  activeTab: 'dashboard',

  latestColMeans: null,
  colMeansHistory: null,
  buyVolume: 0,
  sellVolume: 0,
  buyVolumeHistory: [],
  sellVolumeHistory: [],
  depthBySource: null,
  spreadHistory: [],

  F_t: 100,
  F_tHistory: [],

  revealEnabled: false,
  revealData: null,
  revealHistory: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  updateExtended: (data) => {
    const state = get();
    const newBuyHist = [...state.buyVolumeHistory, data.buyVolume];
    if (newBuyHist.length > MAX_VOLUME_HISTORY) newBuyHist.shift();
    const newSellHist = [...state.sellVolumeHistory, data.sellVolume];
    if (newSellHist.length > MAX_VOLUME_HISTORY) newSellHist.shift();

    const newColMeansHist = state.colMeansHistory ? [...state.colMeansHistory, data.colMeans] : [data.colMeans];
    if (newColMeansHist.length > MAX_HISTORY) newColMeansHist.shift();

    // Track F_t history
    const newF_t = data.F_t ?? state.F_t;
    const newF_tHist = [...state.F_tHistory, newF_t];
    if (newF_tHist.length > MAX_HISTORY) newF_tHist.shift();

    set({
      latestColMeans: data.colMeans,
      colMeansHistory: newColMeansHist,
      buyVolume: data.buyVolume,
      sellVolume: data.sellVolume,
      buyVolumeHistory: newBuyHist,
      sellVolumeHistory: newSellHist,
      depthBySource: data.depthBySource,
      F_t: newF_t,
      F_tHistory: newF_tHist,
    });
  },

  updateReveal: (data) => {
    const state = get();
    const newHist = [...state.revealHistory, {
      F_t: data.F_t,
      kappa_t: data.kappa_t,
      sentiment_t: data.sentiment_t,
    }];
    if (newHist.length > MAX_HISTORY) newHist.shift();

    set({
      revealData: data,
      revealHistory: newHist,
    });
  },

  setRevealEnabled: (enabled) => set({ revealEnabled: enabled }),

  addSpread: (spread) => {
    const state = get();
    const newHist = [...state.spreadHistory, spread];
    if (newHist.length > MAX_HISTORY) newHist.shift();
    set({ spreadHistory: newHist });
  },
}));
