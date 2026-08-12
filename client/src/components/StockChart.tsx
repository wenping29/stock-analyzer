import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import Plot from "react-plotly.js";
import type { KlineData, IndicatorResult } from "../types";
import FullscreenChart from "./FullscreenChart";

interface Props {
  klineData: KlineData[];
  indicators: IndicatorResult[];
  usRateData?: { date: string; rate: number }[];
  usRateLabel?: string;
}

function getCol(ind: IndicatorResult, colName: string): number[] | undefined {
  const idx = ind.columns.indexOf(colName);
  return idx >= 0 ? ind.values[idx] : undefined;
}

export default function StockChart({ klineData, indicators, usRateData, usRateLabel }: Props) {
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [showUsRate, setShowUsRate] = useState(false);

  // 缩放/拖拽操作日志
  const interactCount = useRef(0);
  const handleRelayout = useCallback((e: any) => {
    interactCount.current++;
    const keys = Object.keys(e || {});
    const op = keys.some((k) => k.includes("autorange")) ? "reset"
      : keys.some((k) => k.includes("range")) ? "zoom/pan"
      : "other";
    console.log(`[chart:K线图] #${interactCount.current} ${op}`, {
      time: new Date().toISOString(),
      keys,
      detail: e,
    });
  }, []);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  // 初始化日期范围：默认显示全部
  useEffect(() => {
    if (klineData.length > 0) {
      if (!dateStart) setDateStart(klineData[0].date);
      if (!dateEnd) setDateEnd(klineData[klineData.length - 1].date);
    }
  }, [klineData]);

  // 按日期范围筛选数据
  const { filteredKline, filteredIndicators } = useMemo(() => {
    if (klineData.length === 0) return { filteredKline: [], filteredIndicators: indicators };
    const allDates = klineData.map((d) => d.date);
    let startIdx = 0;
    let endIdx = allDates.length - 1;
    if (dateStart) {
      const i = allDates.findIndex((d) => d >= dateStart);
      if (i >= 0) startIdx = i;
    }
    if (dateEnd) {
      const i = allDates.findIndex((d) => d > dateEnd);
      endIdx = i >= 0 ? i - 1 : allDates.length - 1;
    }
    if (startIdx > endIdx) { startIdx = 0; endIdx = allDates.length - 1; }
    const filteredKline = klineData.slice(startIdx, endIdx + 1);
    const filteredIndicators = indicators.map((ind) => ({
      ...ind,
      values: ind.values.map((arr) => arr.slice(startIdx, endIdx + 1)),
    }));
    return { filteredKline, filteredIndicators };
  }, [klineData, indicators, dateStart, dateEnd]);

  // 快捷时间段
  const setPreset = (months: number | "all") => {
    if (months === "all" || klineData.length === 0) {
      setDateStart(klineData.length > 0 ? klineData[0].date : "");
      setDateEnd(klineData.length > 0 ? klineData[klineData.length - 1].date : "");
      return;
    }
    const end = new Date(klineData[klineData.length - 1].date);
    const start = new Date(end);
    start.setMonth(start.getMonth() - months);
    setDateStart(start.toISOString().slice(0, 10));
    setDateEnd(end.toISOString().slice(0, 10));
  };

  const { candlestick, line, highLine, lowLine, maTraces, bollTraces } = useMemo(() => {
    const dates = filteredKline.map((d) => d.date);

    const candlestick = {
      x: dates,
      open: filteredKline.map((d) => d.open),
      high: filteredKline.map((d) => d.high),
      low: filteredKline.map((d) => d.low),
      close: filteredKline.map((d) => d.close),
      type: "candlestick" as const,
      name: "K线",
      increasing: { line: { color: "#ef4444" }, fillcolor: "#ef4444" },
      decreasing: { line: { color: "#22c55e" }, fillcolor: "#22c55e" },
      xaxis: "x",
      yaxis: "y",
    };

    const line = {
      x: dates,
      y: filteredKline.map((d) => d.close),
      type: "scatter" as const,
      mode: "lines",
      name: "收盘价",
      line: { color: "#f59e0b", width: 1.5 },
      xaxis: "x",
      yaxis: "y",
    };

    const highLine = {
      x: dates,
      y: filteredKline.map((d) => d.high),
      type: "scatter" as const,
      mode: "lines",
      name: "最高价",
      line: { color: "#f87171", width: 1, dash: "dot" },
      xaxis: "x",
      yaxis: "y",
    };

    const lowLine = {
      x: dates,
      y: filteredKline.map((d) => d.low),
      type: "scatter" as const,
      mode: "lines",
      name: "最低价",
      line: { color: "#4ade80", width: 1, dash: "dot" },
      xaxis: "x",
      yaxis: "y",
    };

    const maTraces: any[] = [];
    const bollTraces: any[] = [];

    for (const ind of filteredIndicators) {
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
  }, [filteredKline, filteredIndicators]);

  // 美债利率趋势（对齐K线日期，前向填充）
  const usRateTrace = useMemo(() => {
    if (!showUsRate || !usRateData || usRateData.length === 0 || filteredKline.length === 0) return null;
    const sorted = [...usRateData].sort((a, b) => a.date.localeCompare(b.date));
    const aligned: number[] = [];
    let idx = 0;
    for (const k of filteredKline) {
      while (idx < sorted.length - 1 && sorted[idx + 1].date <= k.date) idx++;
      aligned.push(sorted[idx].date <= k.date ? sorted[idx].rate : NaN);
    }
    return {
      x: filteredKline.map((d) => d.date),
      y: aligned,
      type: "scatter" as const,
      mode: "lines" as const,
      name: `美债${usRateLabel || ""}`,
      line: { color: "#60a5fa", width: 1.5, dash: "dash" },
      xaxis: "x",
      yaxis: "y2",
    };
  }, [showUsRate, usRateData, usRateLabel, filteredKline]);

  const chartTraces = chartType === "line"
    ? [highLine, line, lowLine, ...maTraces, ...bollTraces, ...(usRateTrace ? [usRateTrace] : [])]
    : [candlestick, ...maTraces, ...bollTraces, ...(usRateTrace ? [usRateTrace] : [])];

  return (
    <FullscreenChart title="K线图">
      {(isFullscreen) => (
        <>
          <div className="absolute top-1 right-9 z-10 flex items-center gap-1">
            {/* 快捷时间段 */}
            <div className="flex overflow-hidden rounded bg-gray-800/80 text-xs">
              {([
                { label: "1月", val: 1 },
                { label: "3月", val: 3 },
                { label: "6月", val: 6 },
                { label: "1年", val: 12 },
                { label: "全部", val: "all" as const },
              ] as const).map((p) => (
                <button
                  key={p.label}
                  onClick={() => setPreset(p.val)}
                  className="px-1.5 py-1 text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* 日期选择 */}
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="bg-gray-800/80 text-gray-300 text-xs rounded px-1 py-1 border border-gray-700 outline-none focus:border-blue-600"
            />
            <span className="text-gray-500 text-xs">~</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="bg-gray-800/80 text-gray-300 text-xs rounded px-1 py-1 border border-gray-700 outline-none focus:border-blue-600"
            />
            {/* K线/折线切换 */}
            <div className="flex overflow-hidden rounded bg-gray-800/80 text-xs">
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
            {/* 美债利率叠加 */}
            {usRateData && usRateData.length > 0 && (
              <button
                onClick={() => setShowUsRate((v) => !v)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  showUsRate
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800/80 text-gray-300 hover:bg-gray-700"
                }`}
              >
                美债{usRateLabel || ""}
              </button>
            )}
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
              ...(showUsRate && usRateTrace ? {
                yaxis2: {
                  side: "left",
                  overlaying: "y",
                  gridcolor: "rgba(96,165,250,0.15)",
                  title: { text: "美债利率 %", font: { size: 10, color: "#60a5fa" } },
                  showspikes: false,
                },
              } : {}),
              margin: { t: 30, r: 40, b: 55, l: 40 },
              height: isFullscreen ? Math.max(400, window.innerHeight - 120) : 450,
              showlegend: true,
              legend: { orientation: "h", y: 1.12, font: { size: 10 } },
              dragmode: "zoom",
            }}
            onRelayout={handleRelayout}
            config={{
              responsive: true,
              displayModeBar: true,
              scrollZoom: true,
              displaylogo: false,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
            }}
            style={{ width: "100%" }}
          />
        </>
      )}
    </FullscreenChart>
  );
}
