import type { SimConfig, TickData, OHLCV, BookSnapshot, ExtendedAnalysisData, RevealData } from '../engine/types';

// ============================================================
// Worker <-> UI Message Types
// ============================================================

export type AnalysisMode = 'off' | 'standard' | 'reveal';

/** Commands sent FROM the UI TO the Worker */
export type WorkerCommand =
  | { type: 'START'; seed: number; config?: Partial<SimConfig> }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STEP'; count: number }
  | { type: 'SET_SPEED'; ticksPerSecond: number }
  | { type: 'GET_CANDLES'; resolution: number; from?: number; to?: number }
  | { type: 'GET_BOOK_SNAPSHOT' }
  | { type: 'SET_ANALYSIS_MODE'; mode: AnalysisMode }
  | { type: 'SET_PRICE_SCALE'; value: number }
  | { type: 'RESET'; seed: number; config?: Partial<SimConfig> };

/** Events sent FROM the Worker TO the UI */
export type WorkerEvent =
  | { type: 'TICK'; data: TickData }
  | { type: 'CANDLES'; resolution: number; data: OHLCV[] }
  | { type: 'BOOK_SNAPSHOT'; data: BookSnapshot }
  | { type: 'EXTENDED_ANALYSIS'; data: ExtendedAnalysisData }
  | { type: 'REVEAL_DATA'; data: RevealData }
  | { type: 'STATUS'; status: SimStatus }
  | { type: 'ERROR'; message: string };

export type SimStatus = 'idle' | 'running' | 'paused';
