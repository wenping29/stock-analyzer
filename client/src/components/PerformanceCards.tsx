import type { PerformanceMetrics } from "../types";

const METRIC_CONFIG: { key: keyof PerformanceMetrics; label: string; unit: string; higherIsBetter: boolean }[] = [
  { key: "totalReturn", label: "总收益率", unit: "%", higherIsBetter: true },
  { key: "annualizedReturn", label: "年化收益", unit: "%", higherIsBetter: true },
  { key: "maxDrawdown", label: "最大回撤", unit: "%", higherIsBetter: false },
  { key: "sharpeRatio", label: "夏普比率", unit: "", higherIsBetter: true },
  { key: "winRate", label: "胜率", unit: "%", higherIsBetter: true },
  { key: "profitFactor", label: "盈亏比", unit: "", higherIsBetter: true },
  { key: "totalTrades", label: "交易次数", unit: "", higherIsBetter: true },
  { key: "calmarRatio", label: "卡玛比率", unit: "", higherIsBetter: true },
];

interface Props {
  metrics: PerformanceMetrics | null;
}

export default function PerformanceCards({ metrics }: Props) {
  if (!metrics) {
    return <div className="text-gray-500 text-sm p-4">暂无绩效数据</div>;
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {METRIC_CONFIG.map(({ key, label, unit }) => {
        const value = metrics[key] as number;
        const isPositive = key === "maxDrawdown" ? value <= 20 : value > 0;
        const color = isPositive ? "text-green-400" : "text-red-400";

        return (
          <div key={key} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>
              {value.toFixed(2)}{unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}
