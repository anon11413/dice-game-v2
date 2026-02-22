import { create } from 'zustand';
import { api } from '../api/client';

interface User {
  id: number;
  username: string;
  cash: number;
  sharesA: number;
  sharesB: number;
  avgEntryA: number;
  avgEntryB: number;
  totalCostA: number;
  totalCostB: number;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  guestId: string | null;
  isDevMode: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => void;
  enterDevMode: (pin: string) => boolean;
  exitDevMode: () => void;
  loadFromStorage: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
}

// Dev PIN is checked client-side against hash for simplicity
// In production, you could verify via API
const DEV_PIN = '1337';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isGuest: false,
  guestId: null,
  isDevMode: false,
  isLoading: false,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.login(username, password);
      api.setToken(token);
      localStorage.setItem('dicestock_token', token);
      localStorage.removeItem('dicestock_guest');
      set({ user, token, isGuest: false, guestId: null, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await api.register(username, password);
      api.setToken(token);
      localStorage.setItem('dicestock_token', token);
      localStorage.removeItem('dicestock_guest');
      set({ user, token, isGuest: false, guestId: null, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  loginAsGuest: () => {
    let guestId = localStorage.getItem('dicestock_guest');
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem('dicestock_guest', guestId);
    }
    api.setToken(null);
    set({
      user: null,
      token: null,
      isGuest: true,
      guestId,
      error: null,
    });
  },

  logout: () => {
    api.setToken(null);
    localStorage.removeItem('dicestock_token');
    localStorage.removeItem('dicestock_guest');
    set({
      user: null,
      token: null,
      isGuest: false,
      guestId: null,
      isDevMode: false,
    });
  },

  enterDevMode: (pin: string) => {
    if (pin === DEV_PIN) {
      set({ isDevMode: true });
      sessionStorage.setItem('dicestock_dev', 'true');
      return true;
    }
    return false;
  },

  exitDevMode: () => {
    set({ isDevMode: false });
    sessionStorage.removeItem('dicestock_dev');
  },

  loadFromStorage: async () => {
    // Check dev mode
    if (sessionStorage.getItem('dicestock_dev') === 'true') {
      set({ isDevMode: true });
    }

    // Check JWT token
    const token = localStorage.getItem('dicestock_token');
    if (token) {
      api.setToken(token);
      try {
        const { user } = await api.getMe();
        set({ user, token, isGuest: false });
        return;
      } catch {
        // Token expired or invalid
        localStorage.removeItem('dicestock_token');
        api.setToken(null);
      }
    }

    // Check guest session
    const guestId = localStorage.getItem('dicestock_guest');
    if (guestId) {
      set({ isGuest: true, guestId });
    }
  },

  updateUser: (user) => set({ user }),
  clearError: () => set({ error: null }),
}));
