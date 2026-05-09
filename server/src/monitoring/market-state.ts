import type { KlineData, MarketState } from "@shared/types";
import { getIndicator } from "../indicators";

export function detectMarketState(
  indexData: KlineData[],
  lookbackPeriod: number = 60
): MarketState {
  if (indexData.length < lookbackPeriod) return "ranging";

  const recentData = indexData.slice(-lookbackPeriod);
  const closes = recentData.map((d) => d.close);

  // Calculate MA20 slope
  const ma20 = getIndicator("MA", { period: 20 });
  if (!ma20) return "ranging";

  const maResult = ma20.compute(recentData);
  const maValues = maResult.values[0].filter((v) => !isNaN(v));

  if (maValues.length < 10) return "ranging";

  // MA slope: compare last 10 vs first 10 of MA values
  const firstHalf = maValues.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
  const lastHalf = maValues.slice(-10).reduce((a, b) => a + b, 0) / 10;
  const slope = ((lastHalf - firstHalf) / firstHalf) * 100;

  // Calculate ADX-like trend strength using ATR and price movement
  const atr = getIndicator("ATR", { period: 14 });
  if (!atr) return "ranging";

  const atrResult = atr.compute(recentData);
  const atrValues = atrResult.values[0].filter((v) => !isNaN(v));
  if (atrValues.length < 14) return "ranging";

  const avgAtr = atrValues.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const currentPrice = closes[closes.length - 1];
  const priceRange = (Math.max(...recentData.map((d) => d.high)) - Math.min(...recentData.map((d) => d.low))) / currentPrice * 100;

  // ATR relative to price range = trend strength indicator
  const trendStrength = avgAtr / currentPrice * 100;

  if (trendStrength > 2 && slope > 1) return "trend_up";
  if (trendStrength > 2 && slope < -1) return "trend_down";
  return "ranging";
}
