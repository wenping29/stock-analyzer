import type {
  KlineData, BacktestConfig, WalkForwardConfig,
  WalkForwardResult, OptimizationResult,
} from "@shared/types";
import { BacktestingEngine } from "../backtesting/engine";
import { GridSearchEngine } from "./grid-search";

const engine = new BacktestingEngine();
const gridSearch = new GridSearchEngine();

export class WalkForwardOptimizer {
  run(config: WalkForwardConfig, klineData: KlineData[]): WalkForwardResult[] {
    const results: WalkForwardResult[] = [];
    const insampleDays = config.insampleDays;
    const outsampleDays = config.outsampleDays;

    let insampleStart = 0;
    while (insampleStart + insampleDays + outsampleDays <= klineData.length) {
      const insampleEnd = insampleStart + insampleDays;
      const outsampleStart = insampleEnd;
      const outsampleEnd = Math.min(outsampleStart + outsampleDays, klineData.length);

      const insampleData = klineData.slice(insampleStart, insampleEnd);
      const outsampleData = klineData.slice(insampleStart, outsampleEnd);

      // Grid search on in-sample
      const optimizationConfig = {
        code: config.code,
        name: config.name,
        startDate: insampleData[0].date,
        endDate: insampleData[insampleData.length - 1].date,
        period: config.period,
        baseConfig: config.baseConfig,
        paramRanges: config.paramRanges,
        metric: config.metric,
        topN: config.topN,
      };

      const insampleResults = gridSearch.run(optimizationConfig, insampleData);
      if (insampleResults.length === 0) {
        insampleStart += outsampleDays;
        continue;
      }

      // Take best params from in-sample and test on full window (in+out)
      const bestParams = insampleResults[0].params;
      const fullConfig = this.applyToConfig(
        config.baseConfig,
        config.code,
        config.name,
        outsampleData[0].date,
        outsampleData[outsampleData.length - 1].date,
        config.period,
        bestParams
      );

      const outsampleResult = engine.run(fullConfig, outsampleData);

      // Detect overfitting: out-of-sample sharpe << in-sample sharpe
      const insampleSharpe = insampleResults[0].metrics.sharpeRatio;
      const outsampleSharpe = outsampleResult.metrics.sharpeRatio;
      const overfit = insampleSharpe > 0 && outsampleSharpe < insampleSharpe * 0.5;

      results.push({
        window: {
          insampleStart: insampleData[0].date,
          insampleEnd: insampleData[insampleData.length - 1].date,
          outsampleStart: outsampleData[insampleEnd].date,
          outsampleEnd: outsampleData[outsampleData.length - 1].date,
        },
        insampleBest: insampleResults[0],
        outsampleMetrics: outsampleResult.metrics,
        outsampleTrades: outsampleResult.trades.length,
        overfit,
      });

      // Slide forward by outsample window
      insampleStart += outsampleDays;
    }

    return results;
  }

  private applyToConfig(
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

    for (const cond of config.entryRules.conditions) {
      if ("indicator" in cond && cond.params) {
        const key = `${cond.indicator}.${Object.keys(cond.params)[0]}`;
        if (params[key] !== undefined) {
          cond.params[Object.keys(cond.params)[0]] = params[key];
        }
      }
    }
    return config;
  }
}

export const walkForwardOptimizer = new WalkForwardOptimizer();
