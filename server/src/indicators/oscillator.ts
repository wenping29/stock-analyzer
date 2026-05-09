import type { KlineData } from "../services/fetcher";
import type { Indicator, IndicatorResult } from "./base";
import { sma, crossAbove, crossBelow } from "./base";

// ---------- RSI ----------
export class RSI implements Indicator {
  name = "RSI";
  category = "oscillator" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 14 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const closes = data.map((d) => d.close);
    const p = this.params.period;
    const rsiValues: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const delta = closes[i] - closes[i - 1];
      gains.push(delta > 0 ? delta : 0);
      losses.push(delta < 0 ? -delta : 0);
    }

    let avgGain = gains.slice(0, p).reduce((a, b) => a + b, 0) / p;
    let avgLoss = losses.slice(0, p).reduce((a, b) => a + b, 0) / p;

    for (let i = 0; i < closes.length; i++) {
      if (i < p) {
        rsiValues.push(NaN);
      } else {
        if (i > p) {
          avgGain = (avgGain * (p - 1) + gains[i - 1]) / p;
          avgLoss = (avgLoss * (p - 1) + losses[i - 1]) / p;
        }
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
      }
    }

    const signals: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(rsiValues[i])) {
        if (rsiValues[i] > 70) signals.push({ date: data[i].date, type: "sell", description: `RSI>70（超买）` });
        if (rsiValues[i] < 30) signals.push({ date: data[i].date, type: "buy", description: `RSI<30（超卖）` });
      }
    }

    return { name: this.name, category: this.category, params: this.params, columns: [`RSI_${p}`], values: [rsiValues], signals };
  }
}

// ---------- KDJ ----------
export class KDJ implements Indicator {
  name = "KDJ";
  category = "oscillator" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { n: 9, k: 3, d: 3 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const n = this.params.n;
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const closes = data.map((d) => d.close);

    const kValues: number[] = [];
    const dValues: number[] = [];
    const jValues: number[] = [];

    let k = 50, d = 50;
    for (let i = 0; i < data.length; i++) {
      if (i < n - 1) {
        kValues.push(NaN);
        dValues.push(NaN);
        jValues.push(NaN);
        continue;
      }
      const highest = Math.max(...highs.slice(i - n + 1, i + 1));
      const lowest = Math.min(...lows.slice(i - n + 1, i + 1));
      const rsv = lowest === highest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;
      k = (2 / 3) * k + (1 / 3) * rsv;
      d = (2 / 3) * d + (1 / 3) * k;
      const j = 3 * k - 2 * d;

      kValues.push(k);
      dValues.push(d);
      jValues.push(j);
    }

    const signals: any[] = [];
    const crossUp = crossAbove(kValues, dValues);
    const crossDown = crossBelow(kValues, dValues);
    for (let i = 0; i < data.length; i++) {
      if (crossUp[i]) signals.push({ date: data[i].date, type: "buy", description: "K上穿D（KDJ金叉）" });
      if (crossDown[i]) signals.push({ date: data[i].date, type: "sell", description: "K下穿D（KDJ死叉）" });
      if (!isNaN(kValues[i]) && kValues[i] < 20 && dValues[i] < 20)
        signals.push({ date: data[i].date, type: "buy", description: "K/D<20（超卖）" });
      if (!isNaN(kValues[i]) && kValues[i] > 80 && dValues[i] > 80)
        signals.push({ date: data[i].date, type: "sell", description: "K/D>80（超买）" });
    }

    return { name: this.name, category: this.category, params: this.params, columns: ["K", "D", "J"], values: [kValues, dValues, jValues], signals };
  }
}

// ---------- WR (Williams %R) ----------
export class WilliamsR implements Indicator {
  name = "WR";
  category = "oscillator" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 14 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const p = this.params.period;
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const closes = data.map((d) => d.close);

    const wrValues: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < p - 1) {
        wrValues.push(NaN);
        continue;
      }
      const hh = Math.max(...highs.slice(i - p + 1, i + 1));
      const ll = Math.min(...lows.slice(i - p + 1, i + 1));
      const wr = hh === ll ? 50 : ((hh - closes[i]) / (hh - ll)) * 100;
      wrValues.push(wr);
    }

    const signals: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(wrValues[i])) {
        if (wrValues[i] < 20) signals.push({ date: data[i].date, type: "sell", description: "WR<20（超买）" });
        if (wrValues[i] > 80) signals.push({ date: data[i].date, type: "buy", description: "WR>80（超卖）" });
      }
    }

    return { name: this.name, category: this.category, params: this.params, columns: [`WR_${p}`], values: [wrValues], signals };
  }
}
