import type { KlineData } from "../services/fetcher";
import type { Indicator, IndicatorResult } from "./base";
import { sma, ema, crossAbove, crossBelow } from "./base";

// ---------- MA ----------
export class MovingAverage implements Indicator {
  name = "MA";
  category = "trend" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 20 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const closes = data.map((d) => d.close);
    const p = this.params.period;
    const maValues = sma(closes, p);
    const cols = [`MA_${p}`];

    const signals: any[] = [];
    if (p >= 5) {
      const maShort = sma(closes, 5);
      const crossUp = crossAbove(maShort, maValues);
      const crossDown = crossBelow(maShort, maValues);
      for (let i = 0; i < data.length; i++) {
        if (crossUp[i]) signals.push({ date: data[i].date, type: "buy", description: `MA5上穿MA${p}（金叉）` });
        if (crossDown[i]) signals.push({ date: data[i].date, type: "sell", description: `MA5下穿MA${p}（死叉）` });
      }
    }
    return { name: this.name, category: this.category, params: this.params, columns: cols, values: [maValues], signals };
  }
}

// ---------- EMA ----------
export class ExponentialMA implements Indicator {
  name = "EMA";
  category = "trend" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 20 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const closes = data.map((d) => d.close);
    const p = this.params.period;
    const emaValues = ema(closes, p);
    const cols = [`EMA_${p}`];

    const signals: any[] = [];
    if (p >= 5) {
      const emaShort = ema(closes, 5);
      const crossUp = crossAbove(emaShort, emaValues);
      const crossDown = crossBelow(emaShort, emaValues);
      for (let i = 0; i < data.length; i++) {
        if (crossUp[i]) signals.push({ date: data[i].date, type: "buy", description: `EMA5上穿EMA${p}（金叉）` });
        if (crossDown[i]) signals.push({ date: data[i].date, type: "sell", description: `EMA5下穿EMA${p}（死叉）` });
      }
    }
    return { name: this.name, category: this.category, params: this.params, columns: cols, values: [emaValues], signals };
  }
}

// ---------- MACD ----------
export class MACDIndicator implements Indicator {
  name = "MACD";
  category = "trend" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { fast: 12, slow: 26, signal: 9 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const closes = data.map((d) => d.close);
    const emaFast = ema(closes, this.params.fast);
    const emaSlow = ema(closes, this.params.slow);

    const dif: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (isNaN(emaFast[i]) || isNaN(emaSlow[i])) dif.push(NaN);
      else dif.push(emaFast[i] - emaSlow[i]);
    }

    const dea = ema(dif, this.params.signal);
    const bar: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (isNaN(dif[i]) || isNaN(dea[i])) bar.push(NaN);
      else bar.push(2 * (dif[i] - dea[i]));
    }

    const signals: any[] = [];
    const crossUp = crossAbove(dif, dea);
    const crossDown = crossBelow(dif, dea);
    for (let i = 0; i < data.length; i++) {
      if (crossUp[i]) signals.push({ date: data[i].date, type: "buy", description: "DIF上穿DEA（MACD金叉）" });
      if (crossDown[i]) signals.push({ date: data[i].date, type: "sell", description: "DIF下穿DEA（MACD死叉）" });
    }

    return { name: this.name, category: this.category, params: this.params, columns: ["DIF", "DEA", "BAR"], values: [dif, dea, bar], signals };
  }
}

// ---------- BOLL ----------
export class BollingerBands implements Indicator {
  name = "BOLL";
  category = "trend" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 20, stddev: 2 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const closes = data.map((d) => d.close);
    const p = this.params.period;
    const mid = sma(closes, p);

    const upper: number[] = [];
    const lower: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < p - 1 || isNaN(mid[i])) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = closes.slice(i - p + 1, i + 1);
        const mean = mid[i];
        const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / p;
        const std = Math.sqrt(variance);
        upper.push(mean + this.params.stddev * std);
        lower.push(mean - this.params.stddev * std);
      }
    }

    const signals: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(upper[i]) && closes[i] > upper[i])
        signals.push({ date: data[i].date, type: "sell", description: "价格突破布林上轨（超买）" });
      if (!isNaN(lower[i]) && closes[i] < lower[i])
        signals.push({ date: data[i].date, type: "buy", description: "价格跌破布林下轨（超卖）" });
    }

    return { name: this.name, category: this.category, params: this.params, columns: ["MID", "UPPER", "LOWER"], values: [mid, upper, lower], signals };
  }
}
