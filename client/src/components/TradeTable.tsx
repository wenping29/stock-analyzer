import type { Trade } from "../types";

interface Props {
  trades: Trade[];
}

export default function TradeTable({ trades }: Props) {
  if (trades.length === 0) {
    return <div className="text-gray-500 text-sm p-4">无交易记录</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs uppercase bg-gray-800 text-gray-400">
          <tr>
            <th className="px-3 py-2">买入日期</th>
            <th className="px-3 py-2">买入价</th>
            <th className="px-3 py-2">卖出日期</th>
            <th className="px-3 py-2">卖出价</th>
            <th className="px-3 py-2">数量</th>
            <th className="px-3 py-2">盈亏</th>
            <th className="px-3 py-2">收益率</th>
            <th className="px-3 py-2">退出原因</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {trades.map((t, i) => (
            <tr key={i} className="hover:bg-gray-800/50">
              <td className="px-3 py-2 font-mono">{t.entryDate}</td>
              <td className="px-3 py-2 font-mono">{t.entryPrice.toFixed(2)}</td>
              <td className="px-3 py-2 font-mono">{t.exitDate}</td>
              <td className="px-3 py-2 font-mono">{t.exitPrice.toFixed(2)}</td>
              <td className="px-3 py-2">{t.shares}</td>
              <td className={`px-3 py-2 font-mono ${t.pnl >= 0 ? "text-red-400" : "text-green-400"}`}>
                {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(2)}
              </td>
              <td className={`px-3 py-2 font-mono ${t.pnlPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                {t.pnlPct >= 0 ? "+" : ""}{t.pnlPct.toFixed(2)}%
              </td>
              <td className="px-3 py-2 text-gray-400">{t.exitReason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
