import { useMemo } from "react";
import Plot from "react-plotly.js";

interface Props {
  equityCurve: { date: string; value: number }[];
}

export default function MonthlyHeatmap({ equityCurve }: Props) {
  const { years, months, heatmap, text } = useMemo(() => {
    if (equityCurve.length < 2) return { years: [] as number[], months: [] as string[], heatmap: [] as number[][], text: [] as string[][] };

    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

    // Calculate monthly returns
    const monthlyReturns: Map<string, number> = new Map();
    let prevValue = equityCurve[0].value;
    let prevMonth = equityCurve[0].date.substring(0, 7);

    for (let i = 1; i < equityCurve.length; i++) {
      const currentMonth = equityCurve[i].date.substring(0, 7);
      if (currentMonth !== prevMonth) {
        const ret = ((equityCurve[i - 1].value - prevValue) / prevValue) * 100;
        monthlyReturns.set(prevMonth, ret);
        prevValue = equityCurve[i - 1].value;
        prevMonth = currentMonth;
      }
    }
    // Last month
    const lastRet = ((equityCurve[equityCurve.length - 1].value - prevValue) / prevValue) * 100;
    monthlyReturns.set(prevMonth, lastRet);

    // Build year/month matrix
    const sortedMonths = Array.from(monthlyReturns.keys()).sort();
    if (sortedMonths.length === 0) return { years: [], months: [], heatmap: [], text: [] as string[][] };

    const years = Array.from(new Set(sortedMonths.map((m) => parseInt(m.substring(0, 4))))).sort();
    const z: number[][] = [];
    const t: string[][] = [];

    for (const year of years) {
      const row: number[] = [];
      const tRow: string[] = [];
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, "0")}`;
        const ret = monthlyReturns.get(key);
        if (ret !== undefined) {
          row.push(Math.round(ret * 100) / 100);
          tRow.push(`${year}年${m}月: ${ret.toFixed(2)}%`);
        } else {
          row.push(NaN);
          tRow.push("");
        }
      }
      z.push(row);
      t.push(tRow);
    }

    return { years, months: monthNames, heatmap: z, text: t };
  }, [equityCurve]);

  if (years.length === 0) {
    return <div className="text-gray-500 text-sm p-4">数据不足，无法生成热力图</div>;
  }

  return (
    <Plot
      data={[{
        z: heatmap,
        x: months,
        y: years.map(String),
        type: "heatmap",
        colorscale: [
          [0, "#22c55e"],
          [0.5, "#1f2937"],
          [1, "#ef4444"],
        ],
        zmid: 0,
        text,
        hoverinfo: "text",
        showscale: true,
        colorbar: { title: "%", tickfont: { color: "#9ca3af" } },
      }]}
      layout={{
        paper_bgcolor: "#111827",
        plot_bgcolor: "#111827",
        font: { color: "#9ca3af", size: 11 },
        height: 250,
        margin: { l: 50, r: 30, t: 10, b: 30 },
        xaxis: { color: "#4b5563", side: "top" },
        yaxis: { color: "#4b5563", autorange: "reversed" },
      }}
      config={{ responsive: true, displayModeBar: false }}
      style={{ width: "100%" }}
    />
  );
}
