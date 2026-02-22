import type { OHLCV } from '../types';

// ============================================================
// Technical Indicator Calculations
// All pure functions operating on OHLCV arrays.
// ============================================================

/** Simple Moving Average */
export function sma(candles: OHLCV[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
}

/** Exponential Moving Average */
export function ema(candles: OHLCV[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // First EMA is SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[j].close;
      }
      result.push(sum / period);
    } else {
      const prev = result[i - 1]!;
      result.push((candles[i].close - prev) * multiplier + prev);
    }
  }
  return result;
}

/** Relative Strength Index (14-period default) */
export function rsi(candles: OHLCV[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (candles.length < period + 1) {
    return candles.map(() => null);
  }

  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Fill nulls for insufficient data
  for (let i = 0; i < period; i++) {
    result.push(null);
  }

  // First RSI
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs));

  // Subsequent RSIs using smoothed averages
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs2));
  }

  return result;
}

/** Bollinger Bands */
export interface BollingerData {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function bollingerBands(
  candles: OHLCV[],
  period: number = 20,
  mult: number = 2.0
): BollingerData[] {
  const smaValues = sma(candles, period);
  const result: BollingerData[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (smaValues[i] === null) {
      result.push({ upper: null, middle: null, lower: null });
    } else {
      const mid = smaValues[i]!;
      let sumSqDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const diff = candles[j].close - mid;
        sumSqDiff += diff * diff;
      }
      const stdDev = Math.sqrt(sumSqDiff / period);

      result.push({
        upper: mid + mult * stdDev,
        middle: mid,
        lower: mid - mult * stdDev,
      });
    }
  }

  return result;
}

/** MACD (Moving Average Convergence Divergence) */
export interface MacdData {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function macd(
  candles: OHLCV[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MacdData[] {
  const fastEma = ema(candles, fastPeriod);
  const slowEma = ema(candles, slowPeriod);

  // MACD line = fast EMA - slow EMA
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (fastEma[i] === null || slowEma[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEma[i]! - slowEma[i]!);
    }
  }

  // Signal line = EMA of MACD line
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalLine: (number | null)[] = [];
  const signalMult = 2 / (signalPeriod + 1);
  let signalEma: number | null = null;
  let validCount = 0;

  for (let i = 0; i < candles.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      validCount++;
      if (validCount < signalPeriod) {
        signalLine.push(null);
      } else if (validCount === signalPeriod) {
        let sum = 0;
        let c = 0;
        for (let j = 0; j <= i; j++) {
          if (macdLine[j] !== null) {
            sum += macdLine[j]!;
            c++;
            if (c >= signalPeriod) break;
          }
        }
        // Recalculate: take last signalPeriod valid values
        sum = 0;
        const vals: number[] = [];
        for (let j = i; j >= 0 && vals.length < signalPeriod; j--) {
          if (macdLine[j] !== null) vals.push(macdLine[j]!);
        }
        signalEma = vals.reduce((a, b) => a + b, 0) / vals.length;
        signalLine.push(signalEma);
      } else {
        signalEma = (macdLine[i]! - signalEma!) * signalMult + signalEma!;
        signalLine.push(signalEma);
      }
    }
  }

  // Result
  const result: MacdData[] = [];
  for (let i = 0; i < candles.length; i++) {
    const m = macdLine[i];
    const s = signalLine[i];
    result.push({
      macd: m,
      signal: s,
      histogram: m !== null && s !== null ? m - s : null,
    });
  }

  return result;
}

/** Volume-Weighted Average Price (resets every resetPeriod ticks) */
export function vwap(candles: OHLCV[], resetEvery: number = 390): number[] {
  const result: number[] = [];
  let cumTypicalPriceVol = 0;
  let cumVol = 0;

  for (let i = 0; i < candles.length; i++) {
    if (i > 0 && i % resetEvery === 0) {
      cumTypicalPriceVol = 0;
      cumVol = 0;
    }

    const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumTypicalPriceVol += typicalPrice * candles[i].volume;
    cumVol += candles[i].volume;

    result.push(cumVol > 0 ? cumTypicalPriceVol / cumVol : candles[i].close);
  }

  return result;
}

/** TTM Squeeze: Bollinger Bands inside/outside Keltner Channels */
export interface SqueezeData {
  momentum: number | null;
  squeezeOn: boolean;             // true = squeeze is on (BB inside KC)
}

export function ttmSqueeze(candles: OHLCV[], period: number = 20): SqueezeData[] {
  const result: SqueezeData[] = [];
  const bb = bollingerBands(candles, period, 2.0);

  // Keltner Channel: EMA ± 1.5 * ATR
  const emaValues = ema(candles, period);
  const kcMult = 1.5;

  for (let i = 0; i < candles.length; i++) {
    if (i < period || emaValues[i] === null || bb[i].upper === null) {
      result.push({ momentum: null, squeezeOn: false });
      continue;
    }

    // ATR calculation (simple: average of True Range over period)
    let atrSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tr = Math.max(
        candles[j].high - candles[j].low,
        j > 0 ? Math.abs(candles[j].high - candles[j - 1].close) : 0,
        j > 0 ? Math.abs(candles[j].low - candles[j - 1].close) : 0
      );
      atrSum += tr;
    }
    const atr = atrSum / period;
    const kcUpper = emaValues[i]! + kcMult * atr;
    const kcLower = emaValues[i]! - kcMult * atr;

    // Squeeze is ON when BB is inside KC
    const squeezeOn = bb[i].lower! > kcLower && bb[i].upper! < kcUpper;

    // Momentum: linear regression of (close - midline of BB/KC)
    // Simplified: use close - SMA as momentum proxy
    const momentum = candles[i].close - (bb[i].middle || candles[i].close);

    result.push({ momentum, squeezeOn });
  }

  return result;
}
