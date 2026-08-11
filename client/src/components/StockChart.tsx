import { useMemo, useState } from "react";
import Plot from "react-plotly.js";
import type { KlineData, IndicatorResult } from "../types";
import FullscreenChart from "./FullscreenChart";

interface Props {
  klineData: KlineData[];
  indicators: IndicatorResult[];
}

function getCol(ind: IndicatorResult, colName: string): number[] | undefined {
  const idx = ind.columns.indexOf(colName);
  return idx >= 0 ? ind.values[idx] : undefined;
}

export default function StockChart({ klineData, indicators }: Props) {
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");

  const { candlestick, line, highLine, lowLine, maTraces, bollTraces } = useMemo(() => {
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

    const line = {
      x: dates,
      y: klineData.map((d) => d.close),
      type: "scatter" as const,
      mode: "lines",
      name: "收盘价",
      line: { color: "#f59e0b", width: 1.5 },
      xaxis: "x",
      yaxis: "y",
    };

    const highLine = {
      x: dates,
      y: klineData.map((d) => d.high),
      type: "scatter" as const,
      mode: "lines",
      name: "最高价",
      line: { color: "#f87171", width: 1, dash: "dot" },
      xaxis: "x",
      yaxis: "y",
    };

    const lowLine = {
      x: dates,
      y: klineData.map((d) => d.low),
      type: "scatter" as const,
      mode: "lines",
      name: "最低价",
      line: { color: "#4ade80", width: 1, dash: "dot" },
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

    return { candlestick, line, highLine, lowLine, maTraces, bollTraces };
  }, [klineData, indicators]);

  const chartTraces = chartType === "line"
    ? [highLine, line, lowLine, ...maTraces, ...bollTraces]
    : [candlestick, ...maTraces, ...bollTraces];

  return (
    <FullscreenChart title="K线图">
      {(isFullscreen) => (
        <>
          <div className="absolute top-1 right-9 z-10 flex overflow-hidden rounded bg-gray-800/80 text-xs">
            {(["candlestick", "line"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={`px-2 py-1 transition-colors ${
                  chartType === t
                    ? "bg-blue-700 text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                {t === "candlestick" ? "K线" : "折线"}
              </button>
            ))}
          </div>
          <Plot
            data={chartTraces}
            layout={{
              title: "K线图",
              paper_bgcolor: "#111827",
              plot_bgcolor: "#111827",
              font: { color: "#9ca3af" },
              hovermode: "x unified",
              hoverlabel: {
                bgcolor: "#1f2937",
                bordercolor: "#374151",
                font: { color: "#e5e7eb", size: 11 },
              },
              xaxis: {
                type: "category",
                gridcolor: "#1f2937",
                tickmode: "auto",
                nticks: 8,
                tickangle: -30,
                tickfont: { size: 10 },
                automargin: true,
                rangeslider: { visible: false },
                showspikes: true,
                spikemode: "across",
                spikesnap: "cursor",
                spikedash: "dot",
                spikethickness: 1,
                spikecolor: "#4b5563",
              },
              yaxis: {
                gridcolor: "#1f2937",
                side: "right",
                showspikes: true,
                spikemode: "across",
                spikesnap: "cursor",
                spikedash: "dot",
                spikethickness: 1,
                spikecolor: "#4b5563",
              },
              margin: { t: 30, r: 40, b: 55, l: 40 },
              height: isFullscreen ? Math.max(400, window.innerHeight - 120) : 450,
              showlegend: true,
              legend: { orientation: "h", y: 1.12, font: { size: 10 } },
              dragmode: "pan",
            }}
            config={{ responsive: true, displayModeBar: false, scrollZoom: "x" }}
            style={{ width: "100%" }}
          />
        </>
      )}
    </FullscreenChart>
  );
}
