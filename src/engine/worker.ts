import { Engine } from './Engine';
import type { WorkerCommand, WorkerEvent, AnalysisMode } from '../bridge/messages';

let engine: Engine | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let ticksPerSecond = 10;
let analysisMode: AnalysisMode = 'off';
let tickCounter = 0;

function postEvent(event: WorkerEvent): void {
  // Transfer dice grid buffer when sending tick data (zero-copy)
  if (event.type === 'TICK' && event.data.diceGrid.buffer) {
    self.postMessage(event, [event.data.diceGrid.buffer] as any);
  } else {
    self.postMessage(event);
  }
}

function runTick(): void {
  if (!engine) return;
  const data = engine.tick();
  postEvent({ type: 'TICK', data });

  // Send extended analysis data every 5 ticks when analysis mode is active
  tickCounter++;
  if (analysisMode !== 'off' && tickCounter % 5 === 0) {
    postEvent({ type: 'EXTENDED_ANALYSIS', data: engine.getExtendedAnalysis() });
    if (analysisMode === 'reveal') {
      postEvent({ type: 'REVEAL_DATA', data: engine.getRevealData() });
    }
  }
}

function startLoop(): void {
  stopLoop();
  if (ticksPerSecond <= 0) return;

  const interval = Math.max(1, Math.floor(1000 / ticksPerSecond));
  intervalId = setInterval(runTick, interval);
  postEvent({ type: 'STATUS', status: 'running' });
}

function stopLoop(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

self.onmessage = (e: MessageEvent<WorkerCommand>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'START': {
      engine = new Engine(msg.seed, msg.config);
      startLoop();
      break;
    }

    case 'PAUSE': {
      stopLoop();
      postEvent({ type: 'STATUS', status: 'paused' });
      break;
    }

    case 'RESUME': {
      if (engine) startLoop();
      break;
    }

    case 'STEP': {
      if (!engine) break;
      stopLoop();
      for (let i = 0; i < msg.count; i++) {
        const data = engine.tick();
        postEvent({ type: 'TICK', data });
      }
      postEvent({ type: 'STATUS', status: 'paused' });
      break;
    }

    case 'SET_SPEED': {
      ticksPerSecond = msg.ticksPerSecond;
      if (intervalId !== null) {
        // Restart loop with new speed
        startLoop();
      }
      break;
    }

    case 'GET_CANDLES': {
      if (!engine) break;
      const candles = engine.getCandles(msg.resolution, msg.from, msg.to);
      postEvent({ type: 'CANDLES', resolution: msg.resolution, data: candles });
      break;
    }

    case 'GET_BOOK_SNAPSHOT': {
      if (!engine) break;
      const snapshot = engine.getBookSnapshot();
      postEvent({ type: 'BOOK_SNAPSHOT', data: snapshot });
      break;
    }

    case 'SET_ANALYSIS_MODE': {
      analysisMode = msg.mode;
      break;
    }

    case 'RESET': {
      stopLoop();
      engine = new Engine(msg.seed, msg.config);
      tickCounter = 0;
      postEvent({ type: 'STATUS', status: 'idle' });
      break;
    }
  }
};
