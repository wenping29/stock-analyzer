import type { Indicator } from "./base";
import { MovingAverage, ExponentialMA, MACDIndicator, BollingerBands } from "./trend";
import { RSI, KDJ, WilliamsR } from "./oscillator";
import { VolumeMA, OBV, VolumeRatio } from "./volume";
import { ATR } from "./volatility";
import { INDICATOR_DEFAULTS } from "../config/defaults";

const registry: Record<string, new (params: Record<string, number>) => Indicator> = {
  MA: MovingAverage,
  EMA: ExponentialMA,
  MACD: MACDIndicator,
  BOLL: BollingerBands,
  RSI,
  KDJ,
  WR: WilliamsR,
  VOL: VolumeMA,
  OBV,
  VolumeRatio,
  ATR,
};

export function getIndicator(name: string, params?: Record<string, number>): Indicator | null {
  const Ctor = registry[name];
  if (!Ctor) return null;
  const mergedParams = { ...INDICATOR_DEFAULTS[name], ...params };
  return new Ctor(mergedParams);
}

export function listIndicators(): { name: string; category: string; defaultParams: Record<string, number> }[] {
  return Object.entries(registry).map(([name, Ctor]) => {
    const instance = new Ctor(INDICATOR_DEFAULTS[name] || {});
    return {
      name,
      category: instance.category,
      defaultParams: INDICATOR_DEFAULTS[name] || {},
    };
  });
}

export type { Indicator };
export { INDICATOR_DEFAULTS };
