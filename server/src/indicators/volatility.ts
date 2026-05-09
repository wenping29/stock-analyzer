import type { KlineData } from "../services/fetcher";
import type { Indicator, IndicatorResult } from "./base";
import { sma } from "./base";

// ---------- ATR ----------
export class ATR implements Indicator {
  name = "ATR";
  category = "volatility" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 14 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const p = this.params.period;
    const trValues: number[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        trValues.push(data[i].high - data[i].low);
      } else {
        trValues.push(
          Math.max(
            data[i].high - data[i].low,
            Math.abs(data[i].high - data[i - 1].close),
            Math.abs(data[i].low - data[i - 1].close)
          )
        );
      }
    }

    const atrValues = sma(trValues, p);

    // Smooth with EMA-like for first valid value
    if (p < atrValues.length && !isNaN(atrValues[p - 1])) {
      let prev = atrValues[p - 1];
      for (let i = p; i < atrValues.length; i++) {
        prev = (prev * (p - 1) + trValues[i]) / p;
        atrValues[i] = prev;
      }
    }

    const signals: any[] = [];
    for (let i = 5; i < data.length; i++) {
      if (!isNaN(atrValues[i]) && !isNaN(atrValues[i - 5])) {
        if (atrValues[i] > atrValues[i - 5] * 1.3)
          signals.push({ date: data[i].date, type: "buy", description: "ATR上升（波动加剧）" });
      }
    }

    return { name: this.name, category: this.category, params: this.params, columns: [`ATR_${p}`], values: [atrValues], signals };
  }
}

// BOLL bands are in trend.ts as they combine trend + volatility
