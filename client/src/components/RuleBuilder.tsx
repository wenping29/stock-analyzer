import type { RuleCondition, RuleGroup } from "../types";

const INDICATOR_OPTIONS: { value: string; label: string; defaultParams: Record<string, number> }[] = [
  { value: "MA", label: "MA (移动平均线)", defaultParams: { period: 20 } },
  { value: "EMA", label: "EMA (指数均线)", defaultParams: { period: 20 } },
  { value: "MACD", label: "MACD", defaultParams: {} },
  { value: "BOLL", label: "BOLL (布林带)", defaultParams: { period: 20, stddev: 2 } },
  { value: "RSI", label: "RSI (相对强弱)", defaultParams: { period: 14 } },
  { value: "KDJ", label: "KDJ (随机指标)", defaultParams: {} },
  { value: "WR", label: "WR (威廉指标)", defaultParams: { period: 14 } },
  { value: "VOL", label: "VOL (成交量均线)", defaultParams: { period: 5 } },
  { value: "OBV", label: "OBV (能量潮)", defaultParams: { maPeriod: 20 } },
  { value: "VolumeRatio", label: "量比", defaultParams: { period: 5 } },
  { value: "ATR", label: "ATR (平均真实波幅)", defaultParams: { period: 14 } },
];

const OPERATOR_OPTIONS = [
  { value: ">", label: "大于" },
  { value: "<", label: "小于" },
  { value: ">=", label: "大于等于" },
  { value: "<=", label: "小于等于" },
  { value: "cross_above", label: "上穿" },
  { value: "cross_below", label: "下穿" },
];

interface Props {
  ruleGroup: RuleGroup;
  onChange: (group: RuleGroup) => void;
}

export default function RuleBuilder({ ruleGroup, onChange }: Props) {
  const addCondition = () => {
    const first = INDICATOR_OPTIONS[0];
    const cond: RuleCondition = {
      indicator: first.value,
      operator: ">",
      value: 50,
      params: { ...first.defaultParams },
    };
    onChange({
      ...ruleGroup,
      conditions: [...ruleGroup.conditions, cond],
    });
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    const updated = [...ruleGroup.conditions] as (RuleCondition | RuleGroup)[];
    updated[index] = { ...(updated[index] as RuleCondition), ...updates } as RuleCondition;
    onChange({ ...ruleGroup, conditions: updated });
  };

  const removeCondition = (index: number) => {
    const updated = ruleGroup.conditions.filter((_, i) => i !== index);
    onChange({ ...ruleGroup, conditions: updated });
  };

  const toggleLogic = () => {
    onChange({ ...ruleGroup, logic: ruleGroup.logic === "AND" ? "OR" : "AND" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">逻辑关系：</span>
        <button
          onClick={toggleLogic}
          className={`px-3 py-1 rounded text-sm font-medium ${
            ruleGroup.logic === "AND"
              ? "bg-blue-900/40 text-blue-400 border border-blue-700"
              : "bg-amber-900/40 text-amber-400 border border-amber-700"
          }`}
        >
          {ruleGroup.logic === "AND" ? "AND（全部满足）" : "OR（任一满足）"}
        </button>
        <button onClick={addCondition} className="px-3 py-1 rounded text-sm bg-gray-700 hover:bg-gray-600 text-gray-200">
          + 添加条件
        </button>
      </div>

      {ruleGroup.conditions.map((cond, idx) => {
        const c = cond as RuleCondition;
        const indOpt = INDICATOR_OPTIONS.find((o) => o.value === c.indicator);
        return (
          <div key={idx} className="flex items-center gap-2 bg-gray-900 rounded-lg p-3">
            {idx > 0 && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                {ruleGroup.logic}
              </span>
            )}
            <select
              value={c.indicator}
              onChange={(e) => {
                const opt = INDICATOR_OPTIONS.find((o) => o.value === e.target.value);
                updateCondition(idx, { indicator: e.target.value, params: { ...opt?.defaultParams } });
              }}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
            >
              {INDICATOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={c.operator}
              onChange={(e) => updateCondition(idx, { operator: e.target.value as any })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
            >
              {OPERATOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={c.value}
              onChange={(e) => updateCondition(idx, { value: parseFloat(e.target.value) || 0 })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 w-20"
              step="0.1"
            />
            {indOpt && Object.keys(indOpt.defaultParams).length > 0 && (
              <div className="flex gap-1">
                {Object.keys(indOpt.defaultParams).map((p) => (
                  <span key={p} className="text-xs text-gray-500">
                    {p}={c.params?.[p] ?? indOpt.defaultParams[p]}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={() => removeCondition(idx)}
              className="ml-auto text-gray-500 hover:text-red-400 text-sm"
            >
              ✕
            </button>
          </div>
        );
      })}

      {ruleGroup.conditions.length === 0 && (
        <p className="text-gray-600 text-sm py-4">点击 "+ 添加条件" 添加筛选条件</p>
      )}
    </div>
  );
}
