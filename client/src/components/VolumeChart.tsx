import { useMemo } from "react";
import Plot from "react-plotly.js";
import type { KlineData, IndicatorResult } from "../types";

interface Props {
  klineData: KlineData[];
  indicators: IndicatorResult[];
}

export default function VolumeChart({ klineData, indicators }: Props) {
  const traces = useMemo(() => {
    const dates = klineData.map((d) => d.date);
    const volumes = klineData.map((d) => d.volume);
    const colors = klineData.map((d, i) =>
      i > 0 ? (d.close >= klineData[i - 1].close ? "#ef4444" : "#22c55e") : "#6b7280"
    );

    const result: any[] = [
      {
        x: dates,
        y: volumes,
        type: "bar",
        name: "成交量",
        marker: { color: colors },
        xaxis: "x",
        yaxis: "y",
      },
    ];

    const volInd = indicators.find((r) => r.name === "VOL");
    if (volInd) {
      const p = volInd.params.period || 5;
      const colIdx = volInd.columns.indexOf(`VOL_MA_${p}`);
      const vals = colIdx >= 0 ? volInd.values[colIdx] : undefined;
      if (vals) {
        result.push({
          x: dates, y: vals, type: "scatter", mode: "lines",
          name: `均量${p}日`,
          line: { width: 1.2, color: "#f59e0b" },
          xaxis: "x", yaxis: "y",
        });
      }
    }

    return result;
  }, [klineData, indicators]);

  return (
    <Plot
      data={traces}
      layout={{
        title: "成交量",
        paper_bgcolor: "#111827",
        plot_bgcolor: "#111827",
        font: { color: "#9ca3af" },
        xaxis: { type: "category", gridcolor: "#1f2937" },
        yaxis: { gridcolor: "#1f2937", side: "right" },
        margin: { t: 30, r: 40, b: 30, l: 40 },
        height: 200,
        showlegend: true,
        legend: { orientation: "h", y: 1.3, font: { size: 10 } },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
