import { useState, useEffect, useMemo } from "react";
import type { StockInfo } from "../types";
import { fetchStockList } from "../api/client";
import type { StockListType } from "../api/client";
import { useStockSelection } from "./StockSelectionContext";

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

const PAGE_SIZE = 15;

export default function StockListPanel() {
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<StockListType>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const { selected, selectStock } = useStockSelection();

  useEffect(() => {
    setLoading(true);
    setError("");
    setPage(1);
    fetchStockList(type)
      .then(setStocks)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter(
      (s) =>
        s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [stocks, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <aside
      className={`shrink-0 bg-gray-900 border-l border-gray-800 transition-all duration-300 flex flex-col h-[calc(100vh-52px)] ${
        collapsed ? "w-10" : "w-72"
      }`}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          title="展开面板"
          className="mt-2 mx-auto w-6 h-6 flex items-center justify-center rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white text-xs"
        >
          «
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between p-2 border-b border-gray-800 shrink-0">
            <h2 className="text-sm font-bold text-gray-200">股票列表</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{stocks.length} 只</span>
              <button
                onClick={() => setCollapsed(true)}
                title="收缩面板"
                className="w-6 h-6 flex items-center justify-center rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white text-xs"
              >
                »
              </button>
            </div>
          </div>
          <div className="p-3 border-b border-gray-800 shrink-0">
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
                {pageItems.map((s) => (
                  <li
                    key={s.code}
                    onClick={() => selectStock(s)}
                    className={`flex items-center justify-between px-3 py-1.5 hover:bg-gray-800 text-sm cursor-pointer ${
                      selected?.stock.code === s.code ? "bg-blue-900/40" : ""
                    }`}
                  >
                    <span className="text-gray-300 truncate">{s.name}</span>
                    <span className="font-mono text-gray-500">{s.code}</span>
                  </li>
                ))}
                {pageItems.length === 0 && (
                  <li className="px-3 py-4 text-sm text-gray-500 text-center">
                    无匹配股票
                  </li>
                )}
              </ul>
            )}
          </div>
          {!loading && !error && filtered.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-800 shrink-0">
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-xs text-gray-500">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
