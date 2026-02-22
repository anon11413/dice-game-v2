import { useEffect, useRef, useCallback } from 'react';
import { SimulationBridge } from './SimulationBridge';
import type { WorkerEvent } from './messages';
import type { SimConfig } from '../engine/types';
import { useSimulationStore } from '../store/simulationStore';
import { useMarketStore } from '../store/marketStore';
import { useDiceStore } from '../store/diceStore';
import { useAnalysisStore } from '../store/analysisStore';
import type { AnalysisMode } from './messages';

let sharedBridge: SimulationBridge | null = null;

function getBridge(): SimulationBridge {
  if (!sharedBridge) {
    sharedBridge = new SimulationBridge();
  }
  return sharedBridge;
}

/** Expose the shared bridge for direct access (dev mode chart updates) */
export function getWorkerBridge(): SimulationBridge | null {
  return sharedBridge;
}

/**
 * Main hook connecting the simulation worker to Zustand stores.
 * Throttles UI updates to ~30Hz for performance.
 */
export function useSimulation() {
  const bridge = useRef<SimulationBridge>(getBridge());
  const lastUpdateTime = useRef(0);
  const pendingTick = useRef<WorkerEvent | null>(null);
  const rafId = useRef<number>(0);

  const { setStatus, setTickCount, seed, ticksPerSecond } = useSimulationStore();
  const { updateTick, setCandles, setBookSnapshot } = useMarketStore();
  const { updateDice } = useDiceStore();

  useEffect(() => {
    const b = bridge.current;

    const processTick = () => {
      const event = pendingTick.current;
      if (!event || event.type !== 'TICK') return;
      pendingTick.current = null;

      const d = event.data;
      setTickCount(d.tick);
      updateTick(d.price, d.volume, d.bestBid, d.bestAsk, d.shortInterest, d.utilization, d.bookDepthBid5, d.bookDepthAsk5);
      updateDice(d.diceGrid, d.bandMeans, d.bandStds);
    };

    const unsub = b.subscribe((event: WorkerEvent) => {
      switch (event.type) {
        case 'TICK': {
          // Throttle: only process at ~30fps
          const now = performance.now();
          if (now - lastUpdateTime.current > 33) {
            lastUpdateTime.current = now;
            pendingTick.current = event;
            cancelAnimationFrame(rafId.current);
            rafId.current = requestAnimationFrame(processTick);
          }
          // Always update tick count for accuracy
          if (event.data) {
            setTickCount(event.data.tick);
          }
          break;
        }

        case 'CANDLES': {
          setCandles(event.resolution, event.data);
          break;
        }

        case 'BOOK_SNAPSHOT': {
          setBookSnapshot(event.data);
          break;
        }

        case 'STATUS': {
          setStatus(event.status);
          break;
        }

        case 'EXTENDED_ANALYSIS': {
          useAnalysisStore.getState().updateExtended(event.data);
          break;
        }

        case 'REVEAL_DATA': {
          useAnalysisStore.getState().updateReveal(event.data);
          break;
        }

        case 'ERROR': {
          console.error('Simulation error:', event.message);
          break;
        }
      }
    });

    return () => {
      unsub();
      cancelAnimationFrame(rafId.current);
    };
  }, [setStatus, setTickCount, updateTick, setCandles, setBookSnapshot, updateDice]);

  const start = useCallback((customSeed?: number, config?: Partial<SimConfig>) => {
    bridge.current.send({
      type: 'START',
      seed: customSeed ?? seed,
      config,
    });
  }, [seed]);

  const pause = useCallback(() => {
    bridge.current.send({ type: 'PAUSE' });
  }, []);

  const resume = useCallback(() => {
    bridge.current.send({ type: 'RESUME' });
  }, []);

  const step = useCallback((count: number = 1) => {
    bridge.current.send({ type: 'STEP', count });
  }, []);

  const setSpeed = useCallback((tps: number) => {
    bridge.current.send({ type: 'SET_SPEED', ticksPerSecond: tps });
    useSimulationStore.getState().setTicksPerSecond(tps);
  }, []);

  const requestCandles = useCallback((resolution: number, from?: number, to?: number) => {
    bridge.current.send({ type: 'GET_CANDLES', resolution, from, to });
  }, []);

  const requestBookSnapshot = useCallback(() => {
    bridge.current.send({ type: 'GET_BOOK_SNAPSHOT' });
  }, []);

  const setAnalysisMode = useCallback((mode: AnalysisMode) => {
    bridge.current.send({ type: 'SET_ANALYSIS_MODE', mode });
  }, []);

  const reset = useCallback((customSeed?: number, config?: Partial<SimConfig>) => {
    bridge.current.send({
      type: 'RESET',
      seed: customSeed ?? seed,
      config,
    });
  }, [seed]);

  return {
    start,
    pause,
    resume,
    step,
    setSpeed,
    requestCandles,
    requestBookSnapshot,
    setAnalysisMode,
    reset,
  };
}
