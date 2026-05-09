import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { KlineData, IndicatorResult } from "../types";

interface Props {
  klineData: KlineData[];
  indicators: IndicatorResult[];
}

function getCol(ind: IndicatorResult, colName: string): number[] | undefined {
  const idx = ind.columns.indexOf(colName);
  return idx >= 0 ? ind.values[idx] : undefined;
}

export default function StockChart({ klineData, indicators }: Props) {
  const { candlestick, maTraces, bollTraces } = useMemo(() => {
    const dates = klineData.map((d) => d.date);

    const candlestick = {
      x: dates,
      open: klineData.map((d) => d.open),
      high: klineData.map((d) => d.high),
      low: klineData.map((d) => d.low),
      close: klineData.map((d) => d.close),
      type: "candlestick" as const,
      name: "K线",
      increasing: { line: { color: "#ef4444" }, fillcolor: "#ef4444" },
      decreasing: { line: { color: "#22c55e" }, fillcolor: "#22c55e" },
      xaxis: "x",
      yaxis: "y",
    };

    const maTraces: any[] = [];
    const bollTraces: any[] = [];

    for (const ind of indicators) {
      if (ind.name === "MA") {
        const period = ind.params.period || 20;
        const vals = getCol(ind, `MA_${period}`);
        if (vals) {
          maTraces.push({
            x: dates, y: vals, type: "scatter", mode: "lines",
            name: `MA${period}`,
            line: { width: 1.2 },
            xaxis: "x", yaxis: "y",
          });
        }
      }
      if (ind.name === "EMA") {
        const period = ind.params.period || 20;
        const vals = getCol(ind, `EMA_${period}`);
        if (vals) {
          maTraces.push({
            x: dates, y: vals, type: "scatter", mode: "lines",
            name: `EMA${period}`,
            line: { width: 1.2, dash: "dot" },
            xaxis: "x", yaxis: "y",
          });
        }
      }
      if (ind.name === "BOLL") {
        const mid = getCol(ind, "MID");
        const upper = getCol(ind, "UPPER");
        const lower = getCol(ind, "LOWER");
        if (mid && upper && lower) {
          bollTraces.push(
            { x: dates, y: upper, type: "scatter", mode: "lines", name: "BOLL上轨", line: { width: 0.8, color: "gray" }, xaxis: "x", yaxis: "y" },
            { x: dates, y: mid, type: "scatter", mode: "lines", name: "BOLL中轨", line: { width: 0.8, color: "orange" }, xaxis: "x", yaxis: "y" },
            { x: dates, y: lower, type: "scatter", mode: "lines", name: "BOLL下轨", line: { width: 0.8, color: "gray" }, xaxis: "x", yaxis: "y" },
            {
              x: [...dates, ...dates.slice().reverse()],
              y: [...upper, ...lower.slice().reverse()],
              type: "scatter", mode: "none", fill: "tonexty",
              fillcolor: "rgba(128,128,128,0.1)",
              name: "BOLL带",
              showlegend: false,
              xaxis: "x", yaxis: "y",
            }
          );
        }
      }
    }

    return { candlestick, maTraces, bollTraces };
  }, [klineData, indicators]);

  return (
    <Plot
      data={[candlestick, ...maTraces, ...bollTraces]}
      layout={{
        title: "K线图",
        paper_bgcolor: "#111827",
        plot_bgcolor: "#111827",
        font: { color: "#9ca3af" },
        xaxis: { type: "category", gridcolor: "#1f2937", rangeslider: { visible: false } },
        yaxis: { gridcolor: "#1f2937", side: "right" },
        margin: { t: 30, r: 40, b: 30, l: 40 },
        height: 450,
        showlegend: true,
        legend: { orientation: "h", y: 1.12, font: { size: 10 } },
        dragmode: "pan",
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
