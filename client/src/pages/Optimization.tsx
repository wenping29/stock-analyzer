import { useState, useCallback, useEffect } from "react";
import type {
  StockInfo, RuleGroup, KlinePeriod,
  OptimizationConfig, OptimizationResult, WalkForwardResult,
  BacktestConfig,
} from "../types";
import { searchStock, runGridSearch, runWalkForward } from "../api/client";
import RuleBuilder from "../components/RuleBuilder";
import ParamRangeBuilder from "../components/ParamRangeBuilder";

const DEFAULT_ENTRY_RULES: RuleGroup = {
  logic: "AND",
  conditions: [
    { indicator: "RSI", operator: "<", value: 30, params: { period: 14 } },
  ],
};

export default function Optimization() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [startDate, setStartDate] = useState("2022-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [entryRules, setEntryRules] = useState<RuleGroup>(DEFAULT_ENTRY_RULES);
  const [paramRanges, setParamRanges] = useState<{ indicator: string; param: string; min: number; max: number; step: number }[]>([]);
  const [metric, setMetric] = useState<keyof import("../types").PerformanceMetrics>("sharpeRatio");
  const [topN, setTopN] = useState(10);
  const [mode, setMode] = useState<"grid" | "walkforward">("grid");
  const [insampleDays, setInsampleDays] = useState(504);
  const [outsampleDays, setOutsampleDays] = useState(252);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [wfResults, setWfResults] = useState<WalkForwardResult[] | null>(null);

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await searchStock(query);
        setSearchResults(r.slice(0, 10));
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleRun = useCallback(async () => {
    if (!selectedStock || paramRanges.length === 0) return;
    setLoading(true);
    setError("");
    setResults(null);
    setWfResults(null);

    const baseConfig: Omit<BacktestConfig, "code" | "name" | "startDate" | "endDate" | "period"> = {
      initialCapital: 100000,
      entryRules,
      exitRules: { stopLossPct: 5, takeProfitPct: 15 },
      positionMethod: "fixed",
      positionSizing: 0.1,
      commission: 0.0003,
      slippage: 0.001,
    };

    try {
      if (mode === "grid") {
        const config: OptimizationConfig = {
          code: selectedStock.code,
          name: selectedStock.name,
          startDate,
          endDate,
          period,
          baseConfig,
          paramRanges,
          metric,
          topN,
        };
        const data = await runGridSearch(config);
        setResults(data.data);
      } else {
        const config = {
          code: selectedStock.code,
          name: selectedStock.name,
          startDate,
          endDate,
          period,
          baseConfig,
          paramRanges,
          metric,
          topN,
          insampleDays,
          outsampleDays,
        };
        const data = await runWalkForward(config);
        setWfResults(data.data);
      }
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStock, startDate, endDate, period, entryRules, paramRanges, metric, topN, mode, insampleDays, outsampleDays]);

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto space-y-4">
        <h2 className="text-lg font-bold text-gray-200">参数优化</h2>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">股票</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="输入代码或名称..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500" />
          {searchResults.length > 0 && (
            <ul className="mt-1 bg-gray-800 border border-gray-700 rounded max-h-32 overflow-y-auto">
              {searchResults.map((s) => (
                <li key={s.code} onClick={() => { setSelectedStock(s); setQuery(s.name); setSearchResults([]); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 ${selectedStock?.code === s.code ? "text-blue-400" : "text-gray-300"}`}>
                  {s.code} {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">开始日期</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">结束日期</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">模式</label>
          <div className="flex gap-1">
            <button onClick={() => setMode("grid")}
              className={`flex-1 py-1.5 text-xs rounded ${mode === "grid" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              网格搜索
            </button>
            <button onClick={() => setMode("walkforward")}
              className={`flex-1 py-1.5 text-xs rounded ${mode === "walkforward" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              滚动优化
            </button>
          </div>
        </div>

        {mode === "walkforward" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">样本内(天)</label>
              <input type="number" value={insampleDays} onChange={(e) => setInsampleDays(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">样本外(天)</label>
              <input type="number" value={outsampleDays} onChange={(e) => setOutsampleDays(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-gray-400 block mb-1">优化指标</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value as any)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200">
            <option value="sharpeRatio">夏普比率</option>
            <option value="annualizedReturn">年化收益</option>
            <option value="profitFactor">盈亏比</option>
            <option value="winRate">胜率</option>
            <option value="calmarRatio">卡玛比率</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">返回前N</label>
          <input type="number" value={topN} onChange={(e) => setTopN(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">入场规则</label>
          <RuleBuilder ruleGroup={entryRules} onChange={setEntryRules} />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">参数范围</label>
          <ParamRangeBuilder ranges={paramRanges} onChange={setParamRanges} />
        </div>

        <button onClick={handleRun} disabled={!selectedStock || paramRanges.length === 0 || loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium text-sm">
          {loading ? "优化中..." : "运行优化"}
        </button>

        {error && <div className="text-red-400 text-sm bg-red-900/30 rounded p-2">{error}</div>}
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!loading && !results && !wfResults && (
          <div className="text-gray-500 text-center mt-20">请选择股票、设置参数范围，点击运行优化</div>
        )}
        {loading && <div className="text-gray-500 text-center mt-20">正在运行参数优化...</div>}

        {results && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">网格搜索结果 (Top {results.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs uppercase bg-gray-800 text-gray-400">
                  <tr>
                    <th className="px-3 py-2">排名</th>
                    {Object.keys(results[0]?.params || {}).map((k) => (
                      <th key={k} className="px-3 py-2">{k}</th>
                    ))}
                    <th className="px-3 py-2">夏普</th>
                    <th className="px-3 py-2">年化收益</th>
                    <th className="px-3 py-2">最大回撤</th>
                    <th className="px-3 py-2">胜率</th>
                    <th className="px-3 py-2">交易次数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {results.map((r, i) => (
                    <tr key={i} className={i === 0 ? "bg-blue-900/20" : "hover:bg-gray-800/50"}>
                      <td className="px-3 py-2 font-mono">{i + 1}</td>
                      {Object.values(r.params).map((v, j) => (
                        <td key={j} className="px-3 py-2 font-mono">{v}</td>
                      ))}
                      <td className="px-3 py-2 font-mono">{r.metrics.sharpeRatio.toFixed(2)}</td>
                      <td className="px-3 py-2 font-mono text-red-400">{r.metrics.annualizedReturn.toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono text-green-400">{r.metrics.maxDrawdown.toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono">{r.metrics.winRate.toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono">{r.totalTrades}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {wfResults && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-300">滚动优化结果 ({wfResults.length} 窗口)</h3>
            {wfResults.map((w, i) => (
              <div key={i} className={`bg-gray-900 rounded-lg border p-4 ${w.overfit ? "border-red-800" : "border-gray-800"}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">
                    窗口 {i + 1}: 样本内 {w.window.insampleStart}~{w.window.insampleEnd} → 样本外 {w.window.outsampleStart}~{w.window.outsampleEnd}
                  </span>
                  {w.overfit && <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded">过拟合警告</span>}
                </div>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-500">样本内夏普: </span>
                    <span className="text-gray-200">{w.insampleBest.metrics.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-500">样本外夏普: </span>
                    <span className={w.overfit ? "text-red-400" : "text-green-400"}>
                      {w.outsampleMetrics.sharpeRatio.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-500">最优参数: </span>
                    <span className="text-blue-400">
                      {Object.entries(w.insampleBest.params).map(([k, v]) => `${k}=${v}`).join(", ")}
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-500">交易次数: </span>
                    <span className="text-gray-200">{w.outsampleTrades}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
