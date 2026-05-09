import { useState, useCallback } from "react";
import type { KlineData, KlinePeriod, IndicatorResult, StockInfo } from "../types";
import { searchStock, fetchKline, computeIndicators } from "../api/client";
import StockChart from "../components/StockChart";
import VolumeChart from "../components/VolumeChart";
import IndicatorChart from "../components/IndicatorChart";
import SignalBadge from "../components/SignalBadge";

const INDICATOR_LIST = [
  { name: "MA", label: "MA 移动平均线", category: "trend", defaultParams: { period: 20 } },
  { name: "EMA", label: "EMA 指数均线", category: "trend", defaultParams: { period: 20 } },
  { name: "MACD", label: "MACD", category: "trend", defaultParams: { fast: 12, slow: 26, signal: 9 } },
  { name: "BOLL", label: "布林带", category: "trend", defaultParams: { period: 20, stddev: 2 } },
  { name: "RSI", label: "RSI 相对强弱", category: "oscillator", defaultParams: { period: 14 } },
  { name: "KDJ", label: "KDJ 随机指标", category: "oscillator", defaultParams: { n: 9, k: 3, d: 3 } },
  { name: "WR", label: "WR 威廉指标", category: "oscillator", defaultParams: { period: 14 } },
  { name: "VOL", label: "成交量均线", category: "volume", defaultParams: { period: 5 } },
  { name: "OBV", label: "OBV 能量潮", category: "volume", defaultParams: { maPeriod: 20 } },
  { name: "VolumeRatio", label: "量比", category: "volume", defaultParams: { period: 5 } },
  { name: "ATR", label: "ATR 平均真实波幅", category: "volatility", defaultParams: { period: 14 } },
];

export default function Indicators() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [indicatorResults, setIndicatorResults] = useState<IndicatorResult[]>([]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(["MA", "MACD", "VOL", "RSI"]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [dateRange, setDateRange] = useState({ start: "2024-01-01", end: new Date().toISOString().slice(0, 10) });

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const results = await searchStock(searchQuery.trim());
    setSearchResults(results);
  }, [searchQuery]);

  const handleSelectStock = useCallback(async (stock: StockInfo) => {
    setSelectedStock(stock);
    setSearchResults([]);
    setSearchQuery("");
    setLoading(true);
    try {
      const data = await fetchKline(stock.code, dateRange.start, dateRange.end, period);
      setKlineData(data);

      const indicatorReqs = selectedIndicators.map((name) => {
        const def = INDICATOR_LIST.find((i) => i.name === name);
        return { name, params: def?.defaultParams || {} };
      });
      const results = await computeIndicators(data, indicatorReqs);
      setIndicatorResults(results);
    } finally {
      setLoading(false);
    }
  }, [dateRange, period, selectedIndicators]);

  const handleRefreshIndicators = useCallback(async () => {
    if (!klineData.length) return;
    setLoading(true);
    try {
      const indicatorReqs = selectedIndicators.map((name) => {
        const def = INDICATOR_LIST.find((i) => i.name === name);
        return { name, params: def?.defaultParams || {} };
      });
      const results = await computeIndicators(klineData, indicatorReqs);
      setIndicatorResults(results);
    } finally {
      setLoading(false);
    }
  }, [klineData, selectedIndicators]);

  const toggleIndicator = (name: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // Separate indicators for K-line overlay vs sub-charts
  const overlayIndicators = indicatorResults.filter((r) =>
    ["MA", "EMA", "BOLL"].includes(r.name)
  );
  const subIndicators = indicatorResults.filter((r) =>
    !["MA", "EMA", "BOLL"].includes(r.name)
  );

  return (
    <div className="flex gap-0 h-[calc(100vh-52px)]">
      {/* Left Sidebar */}
      <div className="w-72 shrink-0 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto space-y-5">
        {/* Search */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">股票搜索</label>
          <div className="flex gap-1">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="代码 / 名称"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600"
            />
            <button onClick={handleSearch} className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-sm text-white">
              搜索
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto border border-gray-700 rounded">
              {searchResults.map((s) => (
                <div
                  key={s.code}
                  onClick={() => handleSelectStock(s)}
                  className="px-2 py-1.5 hover:bg-gray-800 cursor-pointer text-sm text-gray-300 flex justify-between"
                >
                  <span>{s.name}</span>
                  <span className="font-mono text-gray-500">{s.code}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected stock */}
        {selectedStock && (
          <div className="bg-gray-800 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-100">{selectedStock.name}</p>
            <p className="text-xs text-gray-500 font-mono">{selectedStock.code}</p>
          </div>
        )}

        {/* Period */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">K线周期</label>
          <div className="grid grid-cols-4 gap-1">
            {(["60min", "daily", "weekly", "monthly"] as KlinePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-xs rounded ${
                  period === p
                    ? "bg-blue-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {{ "60min": "60分", daily: "日线", weekly: "周线", monthly: "月线" }[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">日期范围</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 mb-1"
          />
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
          />
        </div>

        {/* Indicator selection */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">技术指标</label>
          <div className="space-y-1.5">
            {INDICATOR_LIST.map((ind) => (
              <label key={ind.name} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selectedIndicators.includes(ind.name)}
                  onChange={() => toggleIndicator(ind.name)}
                  className="rounded bg-gray-800 border-gray-600"
                />
                <span className="text-gray-300">{ind.label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleRefreshIndicators}
            disabled={!klineData.length}
            className="mt-3 w-full px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200 disabled:opacity-40"
          >
            更新图表
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!selectedStock ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            请搜索并选择一只股票开始分析
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mr-3" />
            加载中...
          </div>
        ) : (
          <>
            <SignalBadge indicators={indicatorResults} />
            <StockChart klineData={klineData} indicators={overlayIndicators} />
            {indicatorResults.some((r) => r.name === "VOL") && (
              <VolumeChart klineData={klineData} indicators={indicatorResults} />
            )}
            {subIndicators.map((ind) => (
              <IndicatorChart key={ind.name} klineData={klineData} indicator={ind} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
