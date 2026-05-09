interface ParamRange {
  indicator: string;
  param: string;
  min: number;
  max: number;
  step: number;
}

interface Props {
  ranges: ParamRange[];
  onChange: (ranges: ParamRange[]) => void;
}

const INDICATOR_PARAMS: Record<string, { label: string; params: { key: string; label: string }[] }> = {
  RSI: { label: "RSI", params: [{ key: "period", label: "周期" }] },
  KDJ: { label: "KDJ", params: [{ key: "n", label: "N" }, { key: "k", label: "K" }, { key: "d", label: "D" }] },
  WR: { label: "WR", params: [{ key: "period", label: "周期" }] },
  MA: { label: "MA", params: [{ key: "period", label: "周期" }] },
  EMA: { label: "EMA", params: [{ key: "period", label: "周期" }] },
  MACD: { label: "MACD", params: [{ key: "fast", label: "快线" }, { key: "slow", label: "慢线" }, { key: "signal", label: "信号" }] },
  BOLL: { label: "BOLL", params: [{ key: "period", label: "周期" }, { key: "stddev", label: "标准差" }] },
  VOL: { label: "VOL", params: [{ key: "period", label: "周期" }] },
  OBV: { label: "OBV", params: [{ key: "maPeriod", label: "MA周期" }] },
  VolumeRatio: { label: "量比", params: [{ key: "period", label: "周期" }] },
  ATR: { label: "ATR", params: [{ key: "period", label: "周期" }] },
};

export default function ParamRangeBuilder({ ranges, onChange }: Props) {
  const addRange = () => {
    // Default: RSI period range
    onChange([...ranges, { indicator: "RSI", param: "period", min: 6, max: 20, step: 2 }]);
  };

  const updateRange = (index: number, field: string, value: string | number) => {
    const updated = ranges.map((r, i) => {
      if (i !== index) return r;
      const newRange = { ...r, [field]: value };
      // If indicator changed, pick first param of that indicator
      if (field === "indicator" && INDICATOR_PARAMS[value as string]) {
        newRange.param = INDICATOR_PARAMS[value as string].params[0].key;
      }
      return newRange;
    });
    onChange(updated);
  };

  const removeRange = (index: number) => {
    onChange(ranges.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      {ranges.map((r, i) => {
        const indicatorInfo = INDICATOR_PARAMS[r.indicator];
        return (
          <div key={i} className="bg-gray-800 rounded p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">参数 {i + 1}</span>
              <button onClick={() => removeRange(i)} className="text-xs text-red-400 hover:text-red-300">移除</button>
            </div>
            <select value={r.indicator} onChange={(e) => updateRange(i, "indicator", e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200">
              {Object.entries(INDICATOR_PARAMS).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
            <select value={r.param} onChange={(e) => updateRange(i, "param", e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200">
              {indicatorInfo?.params.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-xs text-gray-500">最小</label>
                <input type="number" value={r.min} onChange={(e) => updateRange(i, "min", Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-200" />
              </div>
              <div>
                <label className="text-xs text-gray-500">最大</label>
                <input type="number" value={r.max} onChange={(e) => updateRange(i, "max", Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-200" />
              </div>
              <div>
                <label className="text-xs text-gray-500">步长</label>
                <input type="number" value={r.step} onChange={(e) => updateRange(i, "step", Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-1.5 py-1 text-xs text-gray-200" />
              </div>
            </div>
          </div>
        );
      })}
      <button onClick={addRange}
        className="w-full py-1.5 text-xs text-blue-400 border border-dashed border-gray-700 rounded hover:border-blue-500">
        + 添加参数范围
      </button>
    </div>
  );
}
