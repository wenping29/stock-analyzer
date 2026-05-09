import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { Trade } from "../types";

interface Props {
  equityCurve: { date: string; value: number }[];
  trades: Trade[];
  initialCapital: number;
}

export default function EquityCurveChart({ equityCurve, trades, initialCapital }: Props) {
  const traces = useMemo(() => {
    if (equityCurve.length === 0) return [];

    const dates = equityCurve.map((p) => p.date);
    const values = equityCurve.map((p) => p.value);

    // Calculate drawdown
    const drawdown: number[] = [];
    let peak = initialCapital;
    for (const v of values) {
      if (v > peak) peak = v;
      drawdown.push(-((peak - v) / peak) * 100);
    }

    const equityTrace: any = {
      x: dates,
      y: values,
      type: "scatter",
      name: "资金曲线",
      line: { color: "#3b82f6", width: 2 },
      yaxis: "y",
    };

    const ddTrace: any = {
      x: dates,
      y: drawdown,
      type: "scatter",
      name: "回撤 (%)",
      line: { color: "#ef4444", width: 1 },
      fill: "tozeroy",
      fillcolor: "rgba(239,68,68,0.15)",
      yaxis: "y2",
    };

    // Trade markers
    const buyX: string[] = [];
    const buyY: number[] = [];
    const sellX: string[] = [];
    const sellY: number[] = [];

    for (const t of trades) {
      const entryIdx = dates.indexOf(t.entryDate);
      const exitIdx = dates.indexOf(t.exitDate);
      if (entryIdx >= 0) { buyX.push(t.entryDate); buyY.push(values[entryIdx]); }
      if (exitIdx >= 0) { sellX.push(t.exitDate); sellY.push(values[exitIdx]); }
    }

    const buyTrace: any = {
      x: buyX,
      y: buyY,
      type: "scatter",
      mode: "markers",
      name: "买入",
      marker: { symbol: "triangle-up", size: 10, color: "#22c55e" },
      yaxis: "y",
    };

    const sellTrace: any = {
      x: sellX,
      y: sellY,
      type: "scatter",
      mode: "markers",
      name: "卖出",
      marker: { symbol: "triangle-down", size: 10, color: "#ef4444" },
      yaxis: "y",
    };

    return [equityTrace, ddTrace, buyTrace, sellTrace];
  }, [equityCurve, trades, initialCapital]);

  if (equityCurve.length === 0) {
    return <div className="text-gray-500 text-sm p-4">无资金曲线数据</div>;
  }

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: "#111827",
        plot_bgcolor: "#111827",
        font: { color: "#9ca3af", size: 11 },
        height: 350,
        margin: { l: 50, r: 50, t: 10, b: 40 },
        xaxis: { color: "#4b5563", gridcolor: "#1f2937", showgrid: true },
        yaxis: { title: "资金 (元)", color: "#9ca3af", gridcolor: "#1f2937", showgrid: true },
        yaxis2: {
          title: "回撤 (%)",
          overlaying: "y",
          side: "right",
          color: "#ef4444",
          gridcolor: "transparent",
        },
        legend: { orientation: "h", y: 1.12, x: 0, font: { size: 10 } },
        showlegend: true,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
