import { useState, useEffect, useCallback } from "react";
import type { KlineData, KlinePeriod, RealtimeQuote } from "../types";
import { fetchMarketIndexes, fetchIndexKline } from "../api/client";
import StockChart from "../components/StockChart";

function fmtAmount(v?: number): string {
  const n = v ?? 0;
  if (n >= 1e8) return (n / 1e8).toFixed(2) + " 亿";
  if (n >= 1e4) return (n / 1e4).toFixed(2) + " 万";
  return n.toFixed(0);
}

export default function Market() {
  const [indexes, setIndexes] = useState<RealtimeQuote[]>([]);
  const [selected, setSelected] = useState<RealtimeQuote | null>(null);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [loading, setLoading] = useState(true);
  const [klineLoading, setKlineLoading] = useState(false);
  const [error, setError] = useState("");

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
    return () => {
      cancelled = true;
    };
  }, []);

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

  const up = (v?: number) => (v ?? 0) >= 0;

  return (
    <div className="h-[calc(100vh-52px)] overflow-y-auto p-6 space-y-4">
      <h1 className="text-lg font-bold text-gray-100">大盘行情</h1>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="text-sm text-gray-400 py-10 text-center">加载中...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {indexes.map((idx) => (
            <button
              key={idx.code}
              onClick={() => setSelected(idx)}
              className={`text-left bg-gray-900 border rounded-lg p-3 hover:border-gray-600 transition-colors ${
                selected?.code === idx.code
                  ? "border-blue-600"
                  : "border-gray-800"
              }`}
            >
              <p className="text-sm text-gray-400">{idx.name}</p>
              <p className={`text-2xl font-mono font-semibold ${up(idx.changePct) ? "text-red-400" : "text-green-400"}`}>
                {idx.price.toFixed(2)}
              </p>
              <p className={`text-sm font-mono ${up(idx.changePct) ? "text-red-400" : "text-green-400"}`}>
                {up(idx.changePct) ? "+" : ""}
                {idx.changePct.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                成交 {fmtAmount(idx.volume)} / 额 {fmtAmount(idx.amount)}
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
            <StockChart klineData={klineData} indicators={[]} />
          ) : (
            <div className="text-sm text-gray-500 py-10 text-center">暂无行情数据</div>
          )}
        </>
      )}
    </div>
  );
}
