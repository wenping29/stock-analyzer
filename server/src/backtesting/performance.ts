import type { Trade, PerformanceMetrics } from "@shared/types";

export function calculatePerformance(
  trades: Trade[],
  equityCurve: { date: string; value: number }[],
  initialCapital: number
): PerformanceMetrics {
  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].value : initialCapital;
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // Calculate trading days from equity curve span
  let totalYears = 1;
  if (equityCurve.length >= 2) {
    const start = new Date(equityCurve[0].date);
    const end = new Date(equityCurve[equityCurve.length - 1].date);
    totalYears = Math.max((end.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000), 0.25);
  }

  // Annualized return (CAGR)
  const totalReturnDecimal = (finalEquity - initialCapital) / initialCapital;
  const annualizedReturn = totalYears > 0
    ? (Math.pow(1 + totalReturnDecimal, 1 / totalYears) - 1) * 100
    : totalReturn;

  // Max drawdown
  let maxDrawdown = 0;
  let maxDrawdownDuration = 0;
  let peak = initialCapital;
  let ddStart: number | null = null;

  for (let i = 0; i < equityCurve.length; i++) {
    const value = equityCurve[i].value;
    if (value > peak) {
      peak = value;
      ddStart = null;
    } else {
      const dd = ((peak - value) / peak) * 100;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (ddStart === null) ddStart = i;
    }
  }
  // Drawdown duration as rough estimate
  maxDrawdownDuration = ddStart !== null ? equityCurve.length - ddStart : 0;

  // Daily returns for Sharpe/Sortino
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const r = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
    dailyReturns.push(r);
  }

  const avgDailyReturn = dailyReturns.length > 0
    ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    : 0;
  const stdDaily = dailyReturns.length > 1
    ? Math.sqrt(dailyReturns.reduce((s, r) => s + (r - avgDailyReturn) ** 2, 0) / (dailyReturns.length - 1))
    : 0;

  // Sharpe ratio (assuming risk-free rate 3% annually ≈ 0.008% daily)
  const rfDaily = 0.03 / 252;
  const sharpeRatio = stdDaily > 0 ? ((avgDailyReturn - rfDaily) / stdDaily) * Math.sqrt(252) : 0;

  // Sortino ratio (only downside deviation)
  const downsideReturns = dailyReturns.filter((r) => r < 0);
  const avgDownside = downsideReturns.length > 0
    ? downsideReturns.reduce((a, b) => a + b, 0) / downsideReturns.length
    : 0;
  const stdDownside = downsideReturns.length > 1
    ? Math.sqrt(downsideReturns.reduce((s, r) => s + (r - avgDownside) ** 2, 0) / (downsideReturns.length - 1))
    : 0;
  const sortinoRatio = stdDownside > 0 ? ((avgDailyReturn - rfDaily) / stdDownside) * Math.sqrt(252) : 0;

  // Trade statistics
  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl < 0);
  const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;

  const totalGains = winningTrades.reduce((s, t) => s + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0;

  const avgWin = winningTrades.length > 0 ? totalGains / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

  // Calmar ratio
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    annualizedReturn: Math.round(annualizedReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownDuration,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    sortinoRatio: Math.round(sortinoRatio * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    calmarRatio: Math.round(calmarRatio * 100) / 100,
    totalTrades: trades.length,
  };
}
