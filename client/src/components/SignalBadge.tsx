import type { IndicatorResult } from "../types";

interface Props {
  indicators: IndicatorResult[];
}

export default function SignalBadge({ indicators }: Props) {
  if (indicators.length === 0) return null;

  const allSignals = indicators.flatMap((ind) =>
    ind.signals.slice(-3).map((s) => ({
      ...s,
      indicator: ind.name,
    }))
  );

  if (allSignals.length === 0) {
    return <p className="text-gray-500 text-sm">近期无信号</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allSignals.map((s, i) => (
        <span
          key={i}
          className={`px-2 py-1 rounded text-xs font-medium ${
            s.type === "buy"
              ? "bg-red-900/40 text-red-400 border border-red-800"
              : "bg-green-900/40 text-green-400 border border-green-800"
          }`}
        >
          [{s.indicator}] {s.description}
        </span>
      ))}
    </div>
  );
}
