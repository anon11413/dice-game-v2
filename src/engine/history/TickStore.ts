import type { TickLog } from '../types';

/**
 * Ring buffer for recent tick logs.
 * Stores the last N ticks for replay and analysis.
 */
export class TickStore {
  private buffer: TickLog[] = [];
  private capacity: number;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
  }

  append(log: TickLog): void {
    this.buffer.push(log);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  getLast(n: number): TickLog[] {
    return this.buffer.slice(-n);
  }

  getAll(): TickLog[] {
    return this.buffer;
  }

  get length(): number {
    return this.buffer.length;
  }
}
