import type {
  KlineData, BacktestConfig, Trade, BacktestResult,
  PerformanceMetrics, RuleCondition, RuleGroup,
} from "@shared/types";
import { evaluate } from "../screening/rules";
import { getIndicator } from "../indicators";
import { shouldExit } from "./exit-rules";
import { calculatePosition } from "./position";
import { calculatePerformance } from "./performance";

export class BacktestingEngine {
  run(config: BacktestConfig, klineData: KlineData[]): BacktestResult {
    const warmupPeriod = 60; // Need at least 60 days for indicator calculation
    if (klineData.length < warmupPeriod + 1) {
      return {
        config,
        trades: [],
        equityCurve: [{ date: klineData[0]?.date || "", value: config.initialCapital }],
        metrics: this.emptyMetrics(),
      };
    }

    const trades: Trade[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    let cashBalance = config.initialCapital;
    let position: { shares: number; entryPrice: number; entryDate: string; entryIndex: number; allocatedCapital: number } | null = null;

    // Initialize equity curve with initial capital for warmup days
    for (let i = 0; i < warmupPeriod; i++) {
      equityCurve.push({ date: klineData[i].date, value: config.initialCapital });
    }

    for (let i = warmupPeriod; i < klineData.length - 1; i++) {
      const pastData = klineData.slice(0, i + 1); // Data available at decision point
      const nextOpen = klineData[i + 1].open;       // Tomorrow's open for execution
      const nextDate = klineData[i + 1].date;

      if (position) {
        // Holding a position — check exit
        const exitResult = shouldExit(
          pastData,
          position.entryIndex,
          i,
          position.entryPrice,
          config.exitRules
        );

        if (exitResult.exit) {
          // Close position at next open
          const exitPrice = nextOpen * (1 - config.slippage);
          const grossPnl = (exitPrice - position.entryPrice) * position.shares;
          const commission = (position.entryPrice + exitPrice) * position.shares * config.commission;
          const pnl = grossPnl - commission;
          const pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

          cashBalance += position.allocatedCapital + pnl;
          trades.push({
            code: config.code,
            entryDate: position.entryDate,
            entryPrice: position.entryPrice,
            exitDate: nextDate,
            exitPrice,
            shares: position.shares,
            pnl: Math.round(pnl * 100) / 100,
            pnlPct: Math.round(pnlPct * 100) / 100,
            exitReason: exitResult.reason,
          });
          position = null;
        }
      }

      if (!position) {
        // Not holding — check entry
        const entryPassed = evaluate(pastData, config.entryRules);
        if (entryPassed) {
          const entryPrice = nextOpen * (1 + config.slippage);
          const entryDate = nextDate;

          // Calculate position size
          let atr: number | undefined;
          try {
            const atrIndicator = getIndicator("ATR", { period: 14 });
            if (atrIndicator) {
              const atrResult = atrIndicator.compute(pastData);
              atr = atrResult.values[0]?.[i];
            }
          } catch { /* ignore */ }

          const { shares, allocatedCapital } = calculatePosition(
            config.positionMethod,
            cashBalance,
            isNaN(atr as number) ? undefined : atr,
            entryPrice,
            config.positionSizing
          );

          if (shares > 0 && allocatedCapital <= cashBalance) {
            cashBalance -= allocatedCapital;
            position = {
              shares,
              entryPrice,
              entryDate,
              entryIndex: i + 1,
              allocatedCapital,
            };
          }
        }
      }

      // Record daily equity
      const positionValue = position
        ? position.shares * klineData[i + 1].close * (1 - config.slippage)
        : 0;
      equityCurve.push({
        date: nextDate,
        value: cashBalance + positionValue,
      });
    }

    // Force close any remaining position on the last day
    if (position) {
      const lastClose = klineData[klineData.length - 1].close;
      const exitPrice = lastClose * (1 - config.slippage);
      const grossPnl = (exitPrice - position.entryPrice) * position.shares;
      const commission = (position.entryPrice + exitPrice) * position.shares * config.commission;
      const pnl = grossPnl - commission;
      const pnlPct = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;

      cashBalance += position.allocatedCapital + pnl;
      trades.push({
        code: config.code,
        entryDate: position.entryDate,
        entryPrice: position.entryPrice,
        exitDate: klineData[klineData.length - 1].date,
        exitPrice,
        shares: position.shares,
        pnl: Math.round(pnl * 100) / 100,
        pnlPct: Math.round(pnlPct * 100) / 100,
        exitReason: "回测结束",
      });
    }

    const metrics = calculatePerformance(trades, equityCurve, config.initialCapital);
    return { config, trades, equityCurve, metrics };
  }

  private emptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0, annualizedReturn: 0, maxDrawdown: 0, maxDrawdownDuration: 0,
      sharpeRatio: 0, sortinoRatio: 0, winRate: 0, profitFactor: 0,
      avgWin: 0, avgLoss: 0, calmarRatio: 0, totalTrades: 0,
    };
  }
}

export const backtestingEngine = new BacktestingEngine();
