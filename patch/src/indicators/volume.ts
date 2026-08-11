import type { KlineData } from "../services/fetcher";
import type { Indicator, IndicatorResult } from "./base";
import { sma, crossAbove, crossBelow } from "./base";

// ---------- VOL (Volume MA) ----------
export class VolumeMA implements Indicator {
  name = "VOL";
  category = "volume" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 5 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const volumes = data.map((d) => d.volume);
    const p = this.params.period;
    const volMa = sma(volumes, p);

    const signals: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(volMa[i]) && volumes[i] > 2 * volMa[i]) {
        signals.push({ date: data[i].date, type: "buy", description: "成交量放大2倍以上（放量）" });
      }
    }

    return { name: this.name, category: this.category, params: this.params, columns: [`VOL_MA_${p}`], values: [volMa], signals };
  }
}

// ---------- OBV (On-Balance Volume) ----------
export class OBV implements Indicator {
  name = "OBV";
  category = "volume" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { maPeriod: 20 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const obvValues: number[] = [];
    let obv = 0;
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        obv = data[i].volume;
      } else if (data[i].close > data[i - 1].close) {
        obv += data[i].volume;
      } else if (data[i].close < data[i - 1].close) {
        obv -= data[i].volume;
      }
      obvValues.push(obv);
    }

    const mp = this.params.maPeriod || 20;
    const obvMa = sma(obvValues, mp);

    const signals: any[] = [];
    const crossUp = crossAbove(obvValues, obvMa);
    const crossDown = crossBelow(obvValues, obvMa);
    for (let i = 0; i < data.length; i++) {
      if (crossUp[i]) signals.push({ date: data[i].date, type: "buy", description: "OBV上穿均线（资金流入）" });
      if (crossDown[i]) signals.push({ date: data[i].date, type: "sell", description: "OBV下穿均线（资金流出）" });
    }

    return { name: this.name, category: this.category, params: this.params, columns: ["OBV", `OBV_MA_${mp}`], values: [obvValues, obvMa], signals };
  }
}

// ---------- Volume Ratio ----------
export class VolumeRatio implements Indicator {
  name = "VolumeRatio";
  category = "volume" as const;
  params: Record<string, number>;

  constructor(params: Record<string, number> = { period: 5 }) {
    this.params = params;
  }

  compute(data: KlineData[]): IndicatorResult {
    const volumes = data.map((d) => d.volume);
    const p = this.params.period;
    const ratioValues: number[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i < p) {
        ratioValues.push(NaN);
        continue;
      }
      const avgVol = volumes.slice(i - p, i).reduce((a, b) => a + b, 0) / p;
      ratioValues.push(avgVol > 0 ? volumes[i] / avgVol : 1);
    }

    const signals: any[] = [];
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(ratioValues[i])) {
        if (ratioValues[i] > 3) signals.push({ date: data[i].date, type: "buy", description: "量比>3（极度放量）" });
        else if (ratioValues[i] > 1.5) signals.push({ date: data[i].date, type: "buy", description: "量比>1.5（放量）" });
      }
    }

    return { name: this.name, category: this.category, params: this.params, columns: ["VR"], values: [ratioValues], signals };
  }
}
