import type { ScreeningResult } from "../types";

interface Props {
  results: ScreeningResult[];
  loading?: boolean;
  onSelectStock?: (code: string) => void;
}

const PAGE_SIZE = 20;

export default function StockTable({ results, loading, onSelectStock }: Props) {
  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="animate-spin inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mb-3" />
        <p>正在筛选全市场股票...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return <p className="text-gray-500 text-center py-12">暂无结果，请调整筛选条件后重试</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400">
            <th className="text-left py-2 px-3">代码</th>
            <th className="text-left py-2 px-3">名称</th>
            <th className="text-right py-2 px-3">收盘价</th>
            <th className="text-right py-2 px-3">涨跌幅</th>
          </tr>
        </thead>
        <tbody>
          {results.slice(0, PAGE_SIZE).map((r) => (
            <tr
              key={r.code}
              onClick={() => onSelectStock?.(r.code)}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
            >
              <td className="py-2 px-3 font-mono text-gray-300">{r.code}</td>
              <td className="py-2 px-3 text-gray-100">{r.name}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-200">{r.close.toFixed(2)}</td>
              <td className={`py-2 px-3 text-right font-mono ${r.changePct >= 0 ? "text-red-400" : "text-green-400"}`}>
                {r.changePct >= 0 ? "+" : ""}{r.changePct.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-600 mt-2">
        共 {results.length} 条结果，显示前 {Math.min(PAGE_SIZE, results.length)} 条
      </p>
    </div>
  );
}
