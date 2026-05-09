import type {
  KlineData, BacktestConfig, OptimizationConfig,
  OptimizationResult, PerformanceMetrics,
} from "@shared/types";
import { BacktestingEngine } from "../backtesting/engine";

const engine = new BacktestingEngine();
const MAX_COMBINATIONS = 10000;

function generateCombinations(ranges: OptimizationConfig["paramRanges"]): Record<string, number>[] {
  if (ranges.length === 0) return [];

  // Build all combinations via cartesian product
  let combos: Record<string, number>[] = [{}];

  for (const range of ranges) {
    const next: Record<string, number>[] = [];
    for (const combo of combos) {
      for (let val = range.min; val <= range.max; val += range.step) {
        // Round to avoid floating point issues
        const rounded = Math.round(val * 10000) / 10000;
        next.push({ ...combo, [`${range.indicator}.${range.param}`]: rounded });
      }
    }
    combos = next;
    if (combos.length > MAX_COMBINATIONS) {
      throw new Error(`参数组合数 ${combos.length} 超过上限 ${MAX_COMBINATIONS}，请缩小参数范围`);
    }
  }

  return combos;
}

function applyParams(
  baseConfig: Omit<BacktestConfig, "code" | "name" | "startDate" | "endDate" | "period">,
  code: string,
  name: string,
  startDate: string,
  endDate: string,
  period: "daily" | "weekly" | "monthly",
  params: Record<string, number>
): BacktestConfig {
  const config = JSON.parse(JSON.stringify(baseConfig)) as BacktestConfig;
  config.code = code;
  config.name = name;
  config.startDate = startDate;
  config.endDate = endDate;
  config.period = period;

  // Apply params to entryRules conditions
  function applyToConditions(conditions: any[]) {
    for (const cond of conditions) {
      if (cond.logic) {
        applyToConditions(cond.conditions);
      } else {
        const key = `${cond.indicator}.${Object.keys(cond.params)[0]}`;
        if (params[key] !== undefined) {
          cond.params[Object.keys(cond.params)[0]] = params[key];
        }
      }
    }
  }

  applyToConditions(config.entryRules.conditions);
  return config;
}

export class GridSearchEngine {
  run(config: OptimizationConfig, klineData: KlineData[]): OptimizationResult[] {
    const combinations = generateCombinations(config.paramRanges);
    const results: OptimizationResult[] = [];

    for (const combo of combinations) {
      const tunedConfig = applyParams(
        config.baseConfig,
        config.code,
        config.name,
        config.startDate,
        config.endDate,
        config.period,
        combo
      );

      const btResult = engine.run(tunedConfig, klineData);

      results.push({
        params: combo,
        metrics: btResult.metrics,
        totalTrades: btResult.trades.length,
      });
    }

    // Sort by chosen metric descending
    results.sort((a, b) => {
      const aVal = a.metrics[config.metric] as number;
      const bVal = b.metrics[config.metric] as number;
      return bVal - aVal;
    });

    return results.slice(0, config.topN);
  }
}

export const gridSearchEngine = new GridSearchEngine();
