import type { KlineData, ExitRules } from "@shared/types";
import { evaluate } from "../screening/rules";
import { getIndicator } from "../indicators";

export function shouldExit(
  data: KlineData[],
  entryIndex: number,
  currentIndex: number,
  entryPrice: number,
  exitConfig: ExitRules
): { exit: boolean; reason: string } {
  if (currentIndex <= entryIndex) return { exit: false, reason: "" };

  const currentPrice = data[currentIndex].close;
  const changePct = ((currentPrice - entryPrice) / entryPrice) * 100;

  // 1. Fixed % stop loss
  if (exitConfig.stopLossPct && changePct <= -exitConfig.stopLossPct) {
    return { exit: true, reason: `止损 ${changePct.toFixed(1)}%` };
  }

  // 2. ATR-based stop loss
  if (exitConfig.stopLossAtrMultiplier) {
    const atr = getIndicator("ATR", { period: 14 });
    if (atr) {
      const result = atr.compute(data);
      const atrVal = result.values[0]?.[currentIndex];
      if (!isNaN(atrVal)) {
        const stopPrice = entryPrice - exitConfig.stopLossAtrMultiplier * atrVal;
        if (currentPrice <= stopPrice) {
          return { exit: true, reason: `ATR止损 ${changePct.toFixed(1)}%` };
        }
      }
    }
  }

  // 3. Fixed % take profit
  if (exitConfig.takeProfitPct && changePct >= exitConfig.takeProfitPct) {
    return { exit: true, reason: `止盈 ${changePct.toFixed(1)}%` };
  }

  // 4. Indicator-based exit (reuse screening rule engine)
  if (exitConfig.exitIndicator) {
    const passed = evaluate(data, exitConfig.exitIndicator);
    if (passed) {
      return { exit: true, reason: "指标退出信号" };
    }
  }

  return { exit: false, reason: "" };
}
