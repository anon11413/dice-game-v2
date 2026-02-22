import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api/client';
import { useAuthStore } from './authStore';

interface Trade {
  id: number;
  asset: 'A' | 'B';
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  ts: string;
}

interface PlayerState {
  // Guest portfolio (local-only)
  guestCash: number;
  guestSharesA: number;
  guestSharesB: number;
  guestAvgEntryA: number;
  guestAvgEntryB: number;
  guestTotalCostA: number;
  guestTotalCostB: number;
  guestTrades: Trade[];

  // Shared
  tradeHistory: Trade[];
  isTrading: boolean;
  tradeError: string | null;

  executeTrade: (asset: 'A' | 'B', side: 'BUY' | 'SELL', quantity: number, currentPrice: number) => Promise<void>;
  resetAccount: () => Promise<void>;
  loadTradeHistory: () => Promise<void>;
  clearTradeError: () => void;
}

let nextGuestTradeId = 1;

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      guestCash: 100,
      guestSharesA: 0,
      guestSharesB: 0,
      guestAvgEntryA: 0,
      guestAvgEntryB: 0,
      guestTotalCostA: 0,
      guestTotalCostB: 0,
      guestTrades: [],

      tradeHistory: [],
      isTrading: false,
      tradeError: null,

      executeTrade: async (asset, side, quantity, currentPrice) => {
        set({ isTrading: true, tradeError: null });
        const auth = useAuthStore.getState();

        if (auth.isGuest) {
          // Local trade execution for guests
          const state = get();
          const BASE_PRICE = 100;
          const priceA = currentPrice;
          const priceB = Math.max(0.01, 2 * BASE_PRICE - priceA);
          const price = asset === 'A' ? priceA : priceB;
          const total = parseFloat((price * quantity).toFixed(2));

          const shares = asset === 'A' ? state.guestSharesA : state.guestSharesB;
          const totalCost = asset === 'A' ? state.guestTotalCostA : state.guestTotalCostB;

          if (side === 'BUY') {
            if (state.guestCash < total) {
              set({ tradeError: `Insufficient cash. Need $${total.toFixed(2)}, have $${state.guestCash.toFixed(2)}`, isTrading: false });
              return;
            }
            const newShares = shares + quantity;
            const newTotalCost = totalCost + total;
            const newAvgEntry = newShares > 0 ? newTotalCost / newShares : 0;

            const update: any = {
              guestCash: parseFloat((state.guestCash - total).toFixed(2)),
              isTrading: false,
            };
            if (asset === 'A') {
              update.guestSharesA = newShares;
              update.guestAvgEntryA = newAvgEntry;
              update.guestTotalCostA = newTotalCost;
            } else {
              update.guestSharesB = newShares;
              update.guestAvgEntryB = newAvgEntry;
              update.guestTotalCostB = newTotalCost;
            }

            const trade: Trade = {
              id: nextGuestTradeId++,
              asset, side, quantity, price, total,
              ts: new Date().toISOString(),
            };
            update.guestTrades = [trade, ...state.guestTrades].slice(0, 100);
            set(update);
          } else {
            // SELL
            if (shares < quantity) {
              set({ tradeError: `Insufficient shares. Have ${shares}, trying to sell ${quantity}`, isTrading: false });
              return;
            }
            const newShares = shares - quantity;
            const costReduction = shares > 0 ? (quantity / shares) * totalCost : 0;
            const newTotalCost = Math.max(0, totalCost - costReduction);
            const newAvgEntry = newShares > 0 ? newTotalCost / newShares : 0;

            const update: any = {
              guestCash: parseFloat((state.guestCash + total).toFixed(2)),
              isTrading: false,
            };
            if (asset === 'A') {
              update.guestSharesA = newShares;
              update.guestAvgEntryA = newAvgEntry;
              update.guestTotalCostA = newTotalCost;
            } else {
              update.guestSharesB = newShares;
              update.guestAvgEntryB = newAvgEntry;
              update.guestTotalCostB = newTotalCost;
            }

            const trade: Trade = {
              id: nextGuestTradeId++,
              asset, side, quantity, price, total,
              ts: new Date().toISOString(),
            };
            update.guestTrades = [trade, ...state.guestTrades].slice(0, 100);
            set(update);
          }
        } else {
          // Authenticated user — API trade
          try {
            const result = await api.trade(asset, side, quantity);
            useAuthStore.getState().updateUser(result.portfolio);
            set({
              tradeHistory: [result.trade, ...get().tradeHistory].slice(0, 100),
              isTrading: false,
            });
          } catch (err: any) {
            set({ tradeError: err.message, isTrading: false });
          }
        }
      },

      resetAccount: async () => {
        const auth = useAuthStore.getState();
        if (auth.isGuest) {
          set({
            guestCash: 100,
            guestSharesA: 0,
            guestSharesB: 0,
            guestAvgEntryA: 0,
            guestAvgEntryB: 0,
            guestTotalCostA: 0,
            guestTotalCostB: 0,
            guestTrades: [],
            tradeHistory: [],
          });
        } else {
          const result = await api.resetAccount();
          auth.updateUser(result.user);
          set({ tradeHistory: [] });
        }
      },

      loadTradeHistory: async () => {
        const auth = useAuthStore.getState();
        if (!auth.isGuest && auth.token) {
          try {
            const { trades } = await api.getTradeHistory(100);
            set({ tradeHistory: trades });
          } catch {
            // Silently fail
          }
        }
      },

      clearTradeError: () => set({ tradeError: null }),
    }),
    {
      name: 'dicestock-player',
      partialize: (state) => ({
        guestCash: state.guestCash,
        guestSharesA: state.guestSharesA,
        guestSharesB: state.guestSharesB,
        guestAvgEntryA: state.guestAvgEntryA,
        guestAvgEntryB: state.guestAvgEntryB,
        guestTotalCostA: state.guestTotalCostA,
        guestTotalCostB: state.guestTotalCostB,
        guestTrades: state.guestTrades,
      }),
    }
  )
);
