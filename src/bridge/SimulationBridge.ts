import type { WorkerCommand, WorkerEvent } from './messages';

type EventHandler = (event: WorkerEvent) => void;

/**
 * Bridge between the UI and the simulation Web Worker.
 * Wraps postMessage API with typed commands and event subscriptions.
 */
export class SimulationBridge {
  private worker: Worker;
  private listeners: EventHandler[] = [];

  constructor() {
    this.worker = new Worker(
      new URL('../engine/worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (e: MessageEvent<WorkerEvent>) => {
      for (const listener of this.listeners) {
        listener(e.data);
      }
    };

    this.worker.onerror = (e) => {
      console.error('Simulation Worker error:', e);
    };
  }

  /** Send a command to the worker */
  send(command: WorkerCommand): void {
    this.worker.postMessage(command);
  }

  /** Subscribe to all worker events. Returns unsubscribe function. */
  subscribe(handler: EventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      const idx = this.listeners.indexOf(handler);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /** Terminate the worker */
  destroy(): void {
    this.worker.terminate();
    this.listeners = [];
  }
}
