import { useState, useCallback, useEffect } from "react";
import type { BacktestConfig, RuleGroup, StockInfo, Trade, PerformanceMetrics, ExitRules, KlinePeriod } from "../types";
import { searchStock, runBacktest as apiRunBacktest } from "../api/client";
import RuleBuilder from "../components/RuleBuilder";
import EquityCurveChart from "../components/EquityCurveChart";
import PerformanceCards from "../components/PerformanceCards";
import TradeTable from "../components/TradeTable";
import MonthlyHeatmap from "../components/MonthlyHeatmap";

const DEFAULT_ENTRY_RULES: RuleGroup = {
  logic: "AND",
  conditions: [
    { indicator: "EMA", operator: "cross_above", value: 0, params: { period: 5 } },
    { indicator: "MACD", operator: "cross_above", value: 0, params: {} },
  ],
};

export default function Backtest() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockInfo[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockInfo | null>(null);
  const [startDate, setStartDate] = useState("2023-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [initialCapital, setInitialCapital] = useState(100000);
  const [positionMethod, setPositionMethod] = useState<"fixed" | "volatility_weighted">("fixed");
  const [positionSize, setPositionSize] = useState(0.1);
  const [commission, setCommission] = useState(0.0003);
  const [slippage, setSlippage] = useState(0.001);
  const [entryRules, setEntryRules] = useState<RuleGroup>(DEFAULT_ENTRY_RULES);
  const [stopLossPct, setStopLossPct] = useState(5);
  const [takeProfitPct, setTakeProfitPct] = useState(15);
  const [exitRules, setExitRules] = useState<RuleGroup>({
    logic: "AND",
    conditions: [{ indicator: "EMA", operator: "cross_below", value: 0, params: { period: 20 } }],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    trades: Trade[];
    equityCurve: { date: string; value: number }[];
    metrics: PerformanceMetrics;
  } | null>(null);

  // Stock search
  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const results = await searchStock(query);
        setSearchResults(results.slice(0, 10));
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleRunBacktest = useCallback(async () => {
    if (!selectedStock) return;
    setLoading(true);
    setError("");
    setResult(null);

    const exitRulesConfig: ExitRules = {
      stopLossPct,
      takeProfitPct,
      exitIndicator: exitRules,
    };

    const config: BacktestConfig = {
      code: selectedStock.code,
      name: selectedStock.name,
      startDate,
      endDate,
      period,
      initialCapital,
      entryRules,
      exitRules: exitRulesConfig,
      positionMethod,
      positionSizing: positionSize,
      commission,
      slippage,
    };

    try {
      const data = await apiRunBacktest(config);
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStock, startDate, endDate, period, initialCapital, entryRules, exitRules, stopLossPct, takeProfitPct, positionMethod, positionSize, commission, slippage]);

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Sidebar */}
      <div className="w-80 shrink-0 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto space-y-4">
        <h2 className="text-lg font-bold text-gray-200">回测配置</h2>

        {/* Stock search */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">股票</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入代码或名称..."
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          />
          {searchResults.length > 0 && (
            <ul className="mt-1 bg-gray-800 border border-gray-700 rounded max-h-32 overflow-y-auto">
              {searchResults.map((s) => (
                <li
                  key={s.code}
                  onClick={() => { setSelectedStock(s); setQuery(s.name); setSearchResults([]); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-700 ${selectedStock?.code === s.code ? "text-blue-400" : "text-gray-300"}`}
                >
                  {s.code} {s.name}
                </li>
              ))}
            </ul>
          )}
          {selectedStock && <div className="text-xs text-blue-400 mt-1">已选: {selectedStock.code} {selectedStock.name}</div>}
        </div>

        {/* Date range */}
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

        {/* Period */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">周期</label>
          <div className="flex gap-1">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`flex-1 py-1.5 text-xs rounded ${period === p ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                {{daily: "日线", weekly: "周线", monthly: "月线"}[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Capital */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">初始资金</label>
          <input type="number" value={initialCapital} onChange={(e) => setInitialCapital(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
        </div>

        {/* Position method */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">仓位方法</label>
          <div className="flex gap-1">
            <button onClick={() => setPositionMethod("fixed")}
              className={`flex-1 py-1.5 text-xs rounded ${positionMethod === "fixed" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              固定仓位
            </button>
            <button onClick={() => setPositionMethod("volatility_weighted")}
              className={`flex-1 py-1.5 text-xs rounded ${positionMethod === "volatility_weighted" ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"}`}>
              波动率加权
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">仓位比例 ({((positionSize) * 100).toFixed(0)}%)</label>
          <input type="range" min={0.01} max={1} step={0.01} value={positionSize} onChange={(e) => setPositionSize(Number(e.target.value))}
            className="w-full" />
        </div>

        {/* Commission & slippage */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">佣金 ({((commission) * 100).toFixed(2)}%)</label>
            <input type="number" step={0.0001} value={commission} onChange={(e) => setCommission(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">滑点 ({((slippage) * 100).toFixed(1)}%)</label>
            <input type="number" step={0.001} value={slippage} onChange={(e) => setSlippage(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
          </div>
        </div>

        {/* Entry rules */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">入场规则</label>
          <RuleBuilder ruleGroup={entryRules} onChange={setEntryRules} />
        </div>

        {/* Exit rules */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">止损止盈</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">止损 %</label>
              <input type="number" value={stopLossPct} onChange={(e) => setStopLossPct(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500">止盈 %</label>
              <input type="number" value={takeProfitPct} onChange={(e) => setTakeProfitPct(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200" />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-2">退出指标信号</label>
          <RuleBuilder ruleGroup={exitRules} onChange={setExitRules} />
        </div>

        {/* Run button */}
        <button onClick={handleRunBacktest} disabled={!selectedStock || loading}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium text-sm">
          {loading ? "回测中..." : "运行回测"}
        </button>

        {error && <div className="text-red-400 text-sm bg-red-900/30 rounded p-2">{error}</div>}
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!result && !loading && (
          <div className="text-gray-500 text-center mt-20">请选择股票并配置回测参数，点击运行</div>
        )}
        {loading && (
          <div className="text-gray-500 text-center mt-20">正在运行回测...</div>
        )}
        {result && (
          <>
            <PerformanceCards metrics={result.metrics} />
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">资金曲线</h3>
              <EquityCurveChart equityCurve={result.equityCurve} trades={result.trades} initialCapital={initialCapital} />
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">月度收益热力图</h3>
              <MonthlyHeatmap equityCurve={result.equityCurve} />
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">交易记录 ({result.trades.length})</h3>
              <TradeTable trades={result.trades} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
