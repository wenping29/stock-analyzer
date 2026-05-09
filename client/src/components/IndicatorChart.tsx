import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { KlineData, IndicatorResult } from "../types";

interface Props {
  klineData: KlineData[];
  indicator: IndicatorResult;
  height?: number;
}

export default function IndicatorChart({ klineData, indicator, height = 200 }: Props) {
  const { traces, shapes } = useMemo(() => {
    const dates = klineData.map((d) => d.date);
    const traces: any[] = [];
    const shapes: any[] = [];
    const colors = ["#3b82f6", "#f59e0b", "#ef4444", "#22c55e", "#8b5cf6"];

    const { name, columns, values } = indicator;

    columns.forEach((col, idx) => {
      if (values[idx]) {
        const style: any = {
          x: dates, y: values[idx], type: "scatter", mode: "lines",
          name: col,
          line: { width: 1.2, color: colors[idx % colors.length] },
        };
        // MACD BAR as histogram
        if (name === "MACD" && col === "BAR") {
          style.type = "bar";
          style.marker = {
            color: values[idx].map((v: number) => (v >= 0 ? "#ef4444" : "#22c55e")),
          };
        }
        traces.push(style);
      }
    });

    // Add overbought/oversold regions for oscillator indicators
    if (name === "RSI" || name === "WR") {
      const yMax = name === "WR" ? 100 : 100;
      shapes.push(
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 70, y1: 70, line: { dash: "dot", color: "gray", width: 1 }, yref: "y" },
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 30, y1: 30, line: { dash: "dot", color: "gray", width: 1 }, yref: "y" }
      );
    }
    if (name === "KDJ") {
      shapes.push(
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 80, y1: 80, line: { dash: "dot", color: "gray", width: 1 }, yref: "y" },
        { type: "line", x0: dates[0], x1: dates[dates.length - 1], y0: 20, y1: 20, line: { dash: "dot", color: "gray", width: 1 }, yref: "y" }
      );
    }

    return { traces, shapes };
  }, [klineData, indicator]);

  return (
    <Plot
      data={traces}
      layout={{
        title: `${indicator.name} (${Object.entries(indicator.params).map(([k, v]) => `${k}=${v}`).join(", ")})`,
        paper_bgcolor: "#111827",
        plot_bgcolor: "#111827",
        font: { color: "#9ca3af" },
        xaxis: { type: "category", gridcolor: "#1f2937" },
        yaxis: { gridcolor: "#1f2937", side: "right" },
        margin: { t: 30, r: 40, b: 30, l: 40 },
        height,
        showlegend: true,
        legend: { orientation: "h", y: 1.3, font: { size: 10 } },
        shapes,
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
