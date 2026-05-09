import { useState, useCallback, useEffect } from "react";
import type { RuleGroup, ScreeningResult, PresetInfo, KlinePeriod } from "../types";
import { runScreening, fetchPresets, loadPreset } from "../api/client";
import RuleBuilder from "../components/RuleBuilder";
import StockTable from "../components/StockTable";

const STOCK_POOLS = ["全部A股", "创业板"];

const defaultRules: RuleGroup = {
  logic: "AND",
  conditions: [],
};

export default function Screener() {
  const [stockPool, setStockPool] = useState("全部A股");
  const [rules, setRules] = useState<RuleGroup>(defaultRules);
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [results, setResults] = useState<ScreeningResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [dateRange, setDateRange] = useState({
    start: "2024-06-01",
    end: new Date().toISOString().slice(0, 10),
  });
  const [meta, setMeta] = useState<{ total: number; matched: number } | null>(null);

  useEffect(() => {
    fetchPresets().then(setPresets);
  }, []);

  const handleLoadPreset = useCallback(async (key: string) => {
    setSelectedPreset(key);
    if (!key) {
      setRules(defaultRules);
      return;
    }
    const preset = await loadPreset(key);
    setRules(preset);
  }, []);

  const handleRun = useCallback(async () => {
    if (rules.conditions.length === 0) return;
    setLoading(true);
    setMeta(null);
    try {
      const res = await runScreening({
        stockPool,
        rules,
        startDate: dateRange.start,
        endDate: dateRange.end,
        period,
      });
      setResults(res.data || []);
      setMeta(res.meta || null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [stockPool, rules, dateRange]);

  return (
    <div className="flex gap-0 h-[calc(100vh-52px)]">
      {/* Left Sidebar */}
      <div className="w-80 shrink-0 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto space-y-5">
        {/* Stock pool */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">股票池</label>
          <select
            value={stockPool}
            onChange={(e) => setStockPool(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
          >
            {STOCK_POOLS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">预设策略</label>
          <select
            value={selectedPreset}
            onChange={(e) => handleLoadPreset(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200"
          >
            <option value="">-- 自定义规则 --</option>
            {presets.map((p) => (
              <option key={p.key} value={p.key}>{p.name}</option>
            ))}
          </select>
          {presets.map((p) => (
            selectedPreset === p.key && (
              <p key={p.key} className="text-xs text-gray-500 mt-1">{p.description}</p>
            )
          ))}
        </div>

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

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={loading || rules.conditions.length === 0}
          className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "筛选中..." : "执行筛选"}
        </button>

        {/* Meta */}
        {meta && (
          <div className="text-sm text-gray-400 space-y-1">
            <p>扫描股票：{meta.total} 只</p>
            <p>符合条件：<span className="text-blue-400 font-medium">{meta.matched}</span> 只</p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <RuleBuilder ruleGroup={rules} onChange={setRules} />

        <div className="border-t border-gray-800 pt-4">
          <StockTable results={results} loading={loading} />
        </div>
      </div>
    </div>
  );
}
