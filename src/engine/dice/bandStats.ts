import type { BandStats } from '../types';

const BAND_ROWS = 10;
const GRID_COLS = 100;

/**
 * Compute statistics for a single band from the flat grid.
 * Band b occupies grid indices [b*1000 .. (b+1)*1000).
 * Within a band: 10 rows x 100 columns.
 * Column j within band: rows [0..9] at col j => indices j, j+100, j+200, ... j+900 (relative to band start).
 */
export function computeBandStats(grid: Uint8Array, bandIndex: number): BandStats {
  const start = bandIndex * BAND_ROWS * GRID_COLS;
  const count = BAND_ROWS * GRID_COLS; // 1000

  // Compute band mean and std
  let sum = 0;
  for (let i = 0; i < count; i++) {
    sum += grid[start + i];
  }
  const mean = sum / count;

  let sumSqDiff = 0;
  for (let i = 0; i < count; i++) {
    const diff = grid[start + i] - mean;
    sumSqDiff += diff * diff;
  }
  const std = Math.sqrt(sumSqDiff / count);

  // Compute column means (100 columns, 10 dice each)
  const colMeans = new Array<number>(GRID_COLS);
  for (let j = 0; j < GRID_COLS; j++) {
    let colSum = 0;
    for (let r = 0; r < BAND_ROWS; r++) {
      colSum += grid[start + r * GRID_COLS + j];
    }
    colMeans[j] = colSum / BAND_ROWS;
  }

  return { mean, std, colMeans };
}

/** Compute statistics for all bands (dynamic count based on grid size) */
export function computeAllBandStats(grid: Uint8Array): BandStats[] {
  const numBands = Math.floor(grid.length / (BAND_ROWS * GRID_COLS));
  const stats: BandStats[] = new Array(numBands);
  for (let b = 0; b < numBands; b++) {
    stats[b] = computeBandStats(grid, b);
  }
  return stats;
}
