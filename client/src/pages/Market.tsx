import { useState, useEffect, useCallback } from "react";
import Plot from "react-plotly.js";
import type { KlineData, KlinePeriod, RealtimeQuote, MacroIndicator } from "../types";
import { fetchMarketIndexes, fetchIndexKline, fetchMacroIndicators, fetchUsRateHistory, fetchCnRateHistory, fetchIndexPeriodData, fetchFxCnyUsd } from "../api/client";
import StockChart from "../components/StockChart";

export default function Market() {
  const [indexes, setIndexes] = useState<RealtimeQuote[]>([]);
  const [selected, setSelected] = useState<RealtimeQuote | null>(null);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [loading, setLoading] = useState(true);
  const [klineLoading, setKlineLoading] = useState(false);
  const [error, setError] = useState("");
  const [macro, setMacro] = useState<MacroIndicator[]>([]);
  const [us10yRate, setUs10yRate] = useState<{ date: string; rate: number }[]>([]);
  const [rateMaturity, setRateMaturity] = useState("10Y");
  const [cnRate, setCnRate] = useState<{ date: string; rate: number }[]>([]);
  const [cnRateType, setCnRateType] = useState("SHIBOR_3M");
  const [indexPeriod, setIndexPeriod] = useState("daily");
  const [indexPeriodData, setIndexPeriodData] = useState<Record<string, { name: string; data: { date: string; close: number }[] }>>({});
  const [fxPeriod, setFxPeriod] = useState("daily");
  const [fxData, setFxData] = useState<{ date: string; open: number; high: number; low: number; close: number }[]>([]);

  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(end.getFullYear() - 1);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  });

  useEffect(() => {
    let cancelled = false;
    fetchMarketIndexes()
      .then((quotes) => {
        if (cancelled) return;
        setIndexes(quotes);
        if (quotes.length > 0) setSelected(quotes[0]);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchMacroIndicators()
      .then((list) => {
        if (!cancelled) setMacro(list);
      })
      .catch(() => {});
    fetchUsRateHistory(rateMaturity)
      .then((data) => {
        if (!cancelled) setUs10yRate(data);
      })
      .catch(() => {});
    fetchCnRateHistory(cnRateType)
      .then((data) => {
        if (!cancelled) setCnRate(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [rateMaturity, cnRateType]);

  const loadKline = useCallback(async () => {
    if (!selected) return;
    setKlineLoading(true);
    try {
      const data = await fetchIndexKline(
        selected.code,
        dateRange.start,
        dateRange.end,
        period
      );
      setKlineData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setKlineLoading(false);
    }
  }, [selected, dateRange.start, dateRange.end, period]);

  useEffect(() => {
    loadKline();
  }, [loadKline]);

  useEffect(() => {
    let cancelled = false;
    fetchIndexPeriodData(indexPeriod)
      .then((data) => {
        if (!cancelled) setIndexPeriodData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [indexPeriod]);

  useEffect(() => {
    let cancelled = false;
    fetchFxCnyUsd(fxPeriod)
      .then((data) => {
        if (!cancelled) setFxData(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fxPeriod]);

  const up = (v?: number) => (v ?? 0) >= 0;

  return (
    <div className="h-[calc(100vh-52px)] overflow-y-auto p-6 space-y-4">
      <h1 className="text-lg font-bold text-gray-100">大盘行情</h1>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">加载中...</div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-12 gap-2">
          {indexes.map((idx) => (
            <button
              key={idx.code}
              onClick={() => setSelected(idx)}
              className={`text-left bg-gray-900 border rounded-md px-1.5 py-3 hover:border-gray-600 transition-colors flex flex-col justify-center ${
                selected?.code === idx.code
                  ? "border-blue-600"
                  : "border-gray-800"
              }`}
            >
              <p className="text-[11px] text-gray-400 truncate">{idx.name}</p>
              <p className={`text-sm font-mono font-semibold ${up(idx.changePct) ? "text-red-400" : "text-green-400"}`}>
                {idx.price.toFixed(2)}
              </p>
              <p className={`font-mono text-[11px] ${up(idx.changePct) ? "text-red-400" : "text-green-400"}`}>
                {up(idx.changePct) ? "+" : ""}
                {idx.changePct.toFixed(2)}%
              </p>
              <p
                className={`font-mono text-[11px] ${
                  (idx.mainInflow ?? 0) >= 0 ? "text-red-400" : "text-green-400"
                }`}
              >
                {idx.mainInflow == null
                  ? "净流入 --"
                  : `净流入 ${idx.mainInflow >= 0 ? "+" : ""}${(idx.mainInflow / 1e8).toFixed(2)}亿`}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-300 font-medium">{selected.name}</span>
            <span className="font-mono text-xs text-gray-500">{selected.code}</span>
            {(["60min", "daily", "weekly", "monthly"] as KlinePeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2 py-1 text-xs rounded ${
                  period === p
                    ? "bg-blue-700 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                }`}
              >
                {{ "60min": "60分", daily: "日线", weekly: "周线", monthly: "月线" }[p]}
              </button>
            ))}
            <span className="text-xs text-gray-500">
              {dateRange.start} ~ {dateRange.end}
            </span>
          </div>

          {klineLoading ? (
            <div className="text-sm text-gray-400 py-10 text-center">加载中...</div>
          ) : klineData.length > 0 ? (
            <div className="space-y-2">
              <StockChart klineData={klineData} indicators={[]} />
              {macro.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {macro.map((m) => (
                    <div
                      key={m.key}
                      className="flex items-baseline gap-1 rounded-md bg-gray-900/85 border border-gray-700 px-2 py-1"
                    >
                      <span className="text-[10px] text-gray-400">{m.name}</span>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          m.changePct >= 0 ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {m.value.toFixed(m.precision)}
                        {m.unit}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${
                          m.changePct >= 0 ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {m.changePct >= 0 ? "+" : ""}
                        {m.changePct.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {us10yRate.length > 0 && (
                <div className="bg-gray-900/85 border border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-300 font-medium">美债利率历史</span>
                    {(["3M", "6M", "1Y", "10Y"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setRateMaturity(m)}
                        className={`px-2 py-0.5 text-[11px] rounded ${
                          rateMaturity === m
                            ? "bg-blue-700 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <Plot
                    data={[{
                      x: us10yRate.map((d) => d.date),
                      y: us10yRate.map((d) => d.rate),
                      type: "scatter",
                      mode: "lines",
                      name: `${rateMaturity} 美债利率`,
                      line: { color: "#60a5fa", width: 1.5 },
                    }]}
                    layout={{
                      paper_bgcolor: "transparent",
                      plot_bgcolor: "transparent",
                      font: { color: "#9ca3af", size: 10 },
                      margin: { t: 10, r: 20, b: 30, l: 40 },
                      height: 180,
                      xaxis: {
                        gridcolor: "#1f2937",
                        tickmode: "auto",
                        nticks: 6,
                        tickangle: -30,
                        automargin: true,
                        rangeslider: { visible: false },
                      },
                      yaxis: {
                        gridcolor: "#1f2937",
                        side: "right",
                        title: { text: "%", font: { size: 10 }, standoff: 0 },
                      },
                      showlegend: false,
                      hovermode: "x unified",
                      hoverlabel: {
                        bgcolor: "#1f2937",
                        bordercolor: "#374151",
                        font: { color: "#e5e7eb", size: 11 },
                      },
                    }}
                    config={{ responsive: true, displayModeBar: false, scrollZoom: "x" }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              {cnRate.length > 0 && (
                <div className="bg-gray-900/85 border border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-300 font-medium">人民币利率历史</span>
                    {(["SHIBOR_3M", "SHIBOR_6M", "SHIBOR_1Y", "CN_10Y"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setCnRateType(t)}
                        className={`px-2 py-0.5 text-[11px] rounded ${
                          cnRateType === t
                            ? "bg-blue-700 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {t === "SHIBOR_3M" ? "SHIBOR 3M" : t === "SHIBOR_6M" ? "SHIBOR 6M" : t === "SHIBOR_1Y" ? "SHIBOR 1Y" : "中债 10Y"}
                      </button>
                    ))}
                  </div>
                  <Plot
                    data={[{
                      x: cnRate.map((d) => d.date),
                      y: cnRate.map((d) => d.rate),
                      type: "scatter",
                      mode: "lines",
                      name: `${cnRateType} 利率`,
                      line: { color: "#fbbf24", width: 1.5 },
                    }]}
                    layout={{
                      paper_bgcolor: "transparent",
                      plot_bgcolor: "transparent",
                      font: { color: "#9ca3af", size: 10 },
                      margin: { t: 10, r: 20, b: 30, l: 40 },
                      height: 180,
                      xaxis: {
                        gridcolor: "#1f2937",
                        tickmode: "auto",
                        nticks: 6,
                        tickangle: -30,
                        automargin: true,
                        rangeslider: { visible: false },
                      },
                      yaxis: {
                        gridcolor: "#1f2937",
                        side: "right",
                        title: { text: "%", font: { size: 10 }, standoff: 0 },
                      },
                      showlegend: false,
                      hovermode: "x unified",
                      hoverlabel: {
                        bgcolor: "#1f2937",
                        bordercolor: "#374151",
                        font: { color: "#e5e7eb", size: 11 },
                      },
                    }}
                    config={{ responsive: true, displayModeBar: false, scrollZoom: "x" }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              {Object.keys(indexPeriodData).length > 0 && (
                <div className="bg-gray-900/85 border border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-300 font-medium">大盘指标周期数据（归一化 %）</span>
                    {(["daily", "weekly", "monthly", "quarterly", "yearly"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setIndexPeriod(p)}
                        className={`px-2 py-0.5 text-[11px] rounded ${
                          indexPeriod === p
                            ? "bg-blue-700 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {p === "daily" ? "日" : p === "weekly" ? "周" : p === "monthly" ? "月" : p === "quarterly" ? "季" : "年"}
                      </button>
                    ))}
                  </div>
                  <Plot
                    data={Object.entries(indexPeriodData).map(([code, info]) => {
                      const firstClose = info.data.length > 0 ? info.data[0].close : 1;
                      return {
                        x: info.data.map((d) => d.date),
                        y: info.data.map((d) => ((d.close / firstClose) - 1) * 100),
                        type: "scatter",
                        mode: "lines",
                        name: info.name,
                        line: { width: 1.5 },
                      };
                    })}
                    layout={{
                      paper_bgcolor: "transparent",
                      plot_bgcolor: "transparent",
                      font: { color: "#9ca3af", size: 10 },
                      margin: { t: 30, r: 50, b: 30, l: 50 },
                      height: 250,
                      xaxis: {
                        gridcolor: "#1f2937",
                        tickmode: "auto",
                        nticks: 6,
                        tickangle: -30,
                        automargin: true,
                        rangeslider: { visible: false },
                      },
                      yaxis: {
                        gridcolor: "#1f2937",
                        side: "right",
                        title: { text: "%", font: { size: 10 }, standoff: 0 },
                      },
                      showlegend: true,
                      legend: { orientation: "h", y: -0.2, font: { size: 10 }, bgcolor: "rgba(0,0,0,0)" },
                      hovermode: "x unified",
                      hoverlabel: {
                        bgcolor: "#1f2937",
                        bordercolor: "#374151",
                        font: { color: "#e5e7eb", size: 11 },
                      },
                    }}
                    config={{ responsive: true, displayModeBar: false, scrollZoom: "x" }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              {fxData.length > 0 && (
                <div className="bg-gray-900/85 border border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-300 font-medium">人民币/美元汇率 (USD/CNY)</span>
                    {(["daily", "weekly", "monthly", "quarterly", "yearly"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setFxPeriod(p)}
                        className={`px-2 py-0.5 text-[11px] rounded ${
                          fxPeriod === p
                            ? "bg-blue-700 text-white"
                            : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {p === "daily" ? "日" : p === "weekly" ? "周" : p === "monthly" ? "月" : p === "quarterly" ? "季" : "年"}
                      </button>
                    ))}
                  </div>
                  <Plot
                    data={[{
                      x: fxData.map((d) => d.date),
                      y: fxData.map((d) => d.close),
                      type: "scatter",
                      mode: "lines",
                      name: "USD/CNY",
                      line: { color: "#10b981", width: 1.5 },
                    }]}
                    layout={{
                      paper_bgcolor: "transparent",
                      plot_bgcolor: "transparent",
                      font: { color: "#9ca3af", size: 10 },
                      margin: { t: 10, r: 30, b: 30, l: 50 },
                      height: 180,
                      xaxis: {
                        gridcolor: "#1f2937",
                        tickmode: "auto",
                        nticks: 6,
                        tickangle: -30,
                        automargin: true,
                        rangeslider: { visible: false },
                      },
                      yaxis: {
                        gridcolor: "#1f2937",
                        side: "right",
                        title: { text: "汇率", font: { size: 10 }, standoff: 0 },
                      },
                      showlegend: false,
                      hovermode: "x unified",
                      hoverlabel: {
                        bgcolor: "#1f2937",
                        bordercolor: "#374151",
                        font: { color: "#e5e7eb", size: 11 },
                      },
                    }}
                    config={{ responsive: true, displayModeBar: false, scrollZoom: "x" }}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 py-10 text-center">暂无行情数据</div>
          )}
        </>
      )}
    </div>
  );
}
