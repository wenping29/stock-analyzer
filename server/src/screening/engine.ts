import type { KlineData, RuleGroup, ScreeningResult } from "@shared/types";
import { fetcher } from "../services/fetcher";
import { cacheManager } from "../services/cache";
import { evaluate } from "./rules";

export class ScreeningEngine {
  async screen(
    symbols: { code: string; name: string }[],
    rules: RuleGroup,
    startDate: string,
    endDate: string,
    period: string = "daily"
  ): Promise<ScreeningResult[]> {
    const results: ScreeningResult[] = [];
    const total = symbols.length;

    for (let i = 0; i < total; i++) {
      const { code, name } = symbols[i];
      try {
        const cacheKey = `kline_${code}_${period}_${startDate}_${endDate}_qfq`;
        const data = await cacheManager.getOrFetch<KlineData[]>(
          cacheKey,
          () => fetcher.fetchKline(code, startDate, endDate, period as any, "qfq"),
          24 * 60 * 60 * 1000
        );

        if (!data || data.length < 60) continue; // need at least 60 days

        if (evaluate(data, rules)) {
          const last = data[data.length - 1];
          const prev = data[data.length - 2];
          results.push({
            code,
            name,
            close: last.close,
            changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : 0,
            indicators: {}, // populated later
          });
        }
      } catch {
        // skip failed stocks
      }

      // Yield to event loop every 50 stocks
      if (i % 50 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return results;
  }
}

export const screeningEngine = new ScreeningEngine();
