import type { PositionMethod } from "@shared/types";

export function calculatePosition(
  method: PositionMethod,
  capital: number,
  atr: number | undefined,
  price: number,
  fixedPct: number = 0.1
): { shares: number; allocatedCapital: number } {
  let allocatedCapital: number;

  if (method === "volatility_weighted" && atr && atr > 0 && price > 0) {
    // Volatility-weighted: lower ATR → larger position, higher ATR → smaller position
    const volRatio = atr / price; // ATR as % of price
    const weight = Math.min(1 / Math.max(volRatio, 0.01), 1); // cap weight at 1
    allocatedCapital = capital * fixedPct * weight;
  } else {
    // Fixed fraction of capital
    allocatedCapital = capital * fixedPct;
  }

  // Round down to 100-share lots (A股 convention)
  const shares = Math.floor(allocatedCapital / price / 100) * 100;
  return { shares, allocatedCapital };
}
