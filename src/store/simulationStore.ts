import { create } from 'zustand';
import type { SimStatus } from '../bridge/messages';

interface SimulationState {
  status: SimStatus;
  tickCount: number;
  ticksPerSecond: number;
  seed: number;

  setStatus: (status: SimStatus) => void;
  setTickCount: (count: number) => void;
  setTicksPerSecond: (tps: number) => void;
  setSeed: (seed: number) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  status: 'idle',
  tickCount: 0,
  ticksPerSecond: 10,
  seed: 42,

  setStatus: (status) => set({ status }),
  setTickCount: (tickCount) => set({ tickCount }),
  setTicksPerSecond: (ticksPerSecond) => set({ ticksPerSecond }),
  setSeed: (seed) => set({ seed }),
}));
