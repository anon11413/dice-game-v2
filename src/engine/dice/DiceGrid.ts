import type { PRNG } from '../prng';

/**
 * 100x100 grid of d20 dice stored as a flat Uint8Array (10,000 bytes).
 * Band b occupies rows [b*10 .. (b+1)*10), i.e. indices [b*1000 .. (b+1)*1000).
 */
export class DiceGrid {
  private grid: Uint8Array;
  private readonly rows: number;
  private readonly cols: number;

  constructor(rows: number = 100, cols: number = 100) {
    this.rows = rows;
    this.cols = cols;
    this.grid = new Uint8Array(rows * cols);
  }

  /** Roll all dice: fill with uniform random integers [1, 20] */
  roll(prng: PRNG): void {
    // Allocate a fresh buffer each tick (enables Transferable zero-copy to UI)
    this.grid = new Uint8Array(this.rows * this.cols);
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = prng.nextInt(1, 20);
    }
  }

  /** Roll dice reusing existing buffer (no allocation — faster for replay) */
  rollReuse(prng: PRNG): void {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = prng.nextInt(1, 20);
    }
  }

  /** Get value at (row, col) */
  getCell(row: number, col: number): number {
    return this.grid[row * this.cols + col];
  }

  /** Get the 1000-element slice for a band (bandIndex 0-9) */
  getBandSlice(bandIndex: number): Uint8Array {
    const start = bandIndex * 10 * this.cols;
    return this.grid.subarray(start, start + 10 * this.cols);
  }

  /** Get the raw underlying buffer (for transfer to main thread) */
  getRawGrid(): Uint8Array {
    return this.grid;
  }

  /** Get a copy of the grid (for logging without transfer) */
  getGridCopy(): Uint8Array {
    return new Uint8Array(this.grid);
  }
}
