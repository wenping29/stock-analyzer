import type { KlineData, Signal, IndicatorResult, Indicator } from "@shared/types";
export type { Signal, IndicatorResult, Indicator };

// Simple rolling mean
export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) {
      result.push(sum / period);
    } else {
      result.push(NaN);
    }
  }
  return result;
}

// Exponential moving average
export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const alpha = 2 / (period + 1);
  // Seed EMA with SMA for first value
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else if (i === period - 1) {
      result.push(prev);
    } else {
      prev = alpha * values[i] + (1 - alpha) * prev;
      result.push(prev);
    }
  }
  return result;
}

// Cross detection: returns true where fast crosses above slow
export function crossAbove(fast: number[], slow: number[]): boolean[] {
  const result: boolean[] = new Array(fast.length).fill(false);
  for (let i = 1; i < fast.length; i++) {
    if (
      !isNaN(fast[i]) && !isNaN(slow[i]) &&
      !isNaN(fast[i - 1]) && !isNaN(slow[i - 1]) &&
      fast[i] > slow[i] && fast[i - 1] <= slow[i - 1]
    ) {
      result[i] = true;
    }
  }
  return result;
}

export function crossBelow(fast: number[], slow: number[]): boolean[] {
  const result: boolean[] = new Array(fast.length).fill(false);
  for (let i = 1; i < fast.length; i++) {
    if (
      !isNaN(fast[i]) && !isNaN(slow[i]) &&
      !isNaN(fast[i - 1]) && !isNaN(slow[i - 1]) &&
      fast[i] < slow[i] && fast[i - 1] >= slow[i - 1]
    ) {
      result[i] = true;
    }
  }
  return result;
}
