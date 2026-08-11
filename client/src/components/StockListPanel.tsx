import { useState, useEffect, useMemo } from "react";
import type { StockInfo } from "../types";
import { fetchStockList } from "../api/client";
import type { StockListType } from "../api/client";

const STOCK_TYPES: { value: StockListType; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "a", label: "A股" },
  { value: "b", label: "B股" },
  { value: "sh", label: "上交所" },
  { value: "sz", label: "深交所" },
  { value: "bj", label: "北交所" },
  { value: "chinext", label: "创业板" },
  { value: "star", label: "科创板" },
  { value: "neeq", label: "新三板" },
];

export default function StockListPanel() {
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<StockListType>("all");

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchStockList(type)
      .then(setStocks)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter(
      (s) =>
        s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [stocks, query]);

  return (
    <aside className="w-72 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col h-[calc(100vh-52px)]">
      <div className="p-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-gray-200">股票列表</h2>
          <span className="text-xs text-gray-500">{stocks.length} 只</span>
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as StockListType)}
          className="w-full mb-2 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        >
          {STOCK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索代码 / 名称"
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-sm text-gray-500">加载中...</div>}
        {error && <div className="p-4 text-sm text-red-400">{error}</div>}
        {!loading && !error && (
          <ul className="divide-y divide-gray-800">
            {filtered.map((s) => (
              <li
                key={s.code}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-800 text-sm"
              >
                <span className="text-gray-300 truncate">{s.name}</span>
                <span className="font-mono text-gray-500">{s.code}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
