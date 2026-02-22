import { create } from 'zustand';

interface IndicatorSettings {
  enabled: {
    volume: boolean;
    rsi: boolean;
    macd: boolean;
    bollingerBands: boolean;
    sma20: boolean;
    sma50: boolean;
    sma200: boolean;
    ema20: boolean;
    ttmSqueeze: boolean;
    vwap: boolean;
  };

  toggle: (key: keyof IndicatorSettings['enabled']) => void;
}

export const useIndicatorStore = create<IndicatorSettings>((set) => ({
  enabled: {
    volume: true,        // On by default
    rsi: false,
    macd: false,
    bollingerBands: false,
    sma20: false,
    sma50: false,
    sma200: false,
    ema20: false,
    ttmSqueeze: false,
    vwap: false,
  },

  toggle: (key) =>
    set((state) => ({
      enabled: { ...state.enabled, [key]: !state.enabled[key] },
    })),
}));
