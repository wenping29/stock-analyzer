import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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

const PAGE_SIZE = 20;

export default function StockListPanel() {
  const [stocks, setStocks] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<StockListType>("all");
  const [collapsed, setCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const { selected, selectStock } = useStockSelection();
  const navigate = useNavigate();

  const handleSelectStock = (s: StockInfo) => {
    selectStock(s);
    navigate("/indicators");
  };

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Keep page in valid range when data/size changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const handleTypeChange = (t: StockListType) => {
    setType(t);
    setPage(1);
  };

  const handleQueryChange = (q: string) => {
    setQuery(q);
    setPage(1);
  };

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
            <div className="flex flex-wrap gap-1 mb-2">
              {STOCK_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleTypeChange(t.value)}
                  className={`px-2 py-1 text-xs rounded ${
                    type === t.value
                      ? "bg-blue-700 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
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
                    onClick={() => handleSelectStock(s)}
                    className={`flex items-center justify-between px-3 py-1.5 hover:bg-gray-800 text-sm cursor-pointer ${
                      selected?.stock.code === s.code ? "bg-blue-900/40" : ""
                    }`}
                  >
                    <span className="text-gray-300 truncate flex-1">{s.name}</span>
                    <span className="font-mono text-gray-500">{s.code}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/stock/${s.code}`);
                      }}
                      title={`${s.name} 详情`}
                      className="ml-2 px-1.5 py-0.5 text-xs rounded bg-gray-800 text-gray-400 hover:bg-blue-700 hover:text-white"
                    >
                      详情
                    </button>
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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span className="text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
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
