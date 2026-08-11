import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { KlineData, KlinePeriod, StockInfo, RealtimeQuote } from "../types";
import { fetchStockDetail, fetchKline } from "../api/client";
import StockChart from "../components/StockChart";
import VolumeChart from "../components/VolumeChart";

function fmtAmount(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
  if (v >= 1e4) return (v / 1e4).toFixed(2) + " 万";
  return v.toFixed(0);
}

export default function StockDetail() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [info, setInfo] = useState<StockInfo | null>(null);
  const [quote, setQuote] = useState<RealtimeQuote | null>(null);
  const [klineData, setKlineData] = useState<KlineData[]>([]);
  const [period, setPeriod] = useState<KlinePeriod>("daily");
  const [loading, setLoading] = useState(true);
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

  const loadKline = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchKline(code, dateRange.start, dateRange.end, period);
      setKlineData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [code, dateRange.start, dateRange.end, period]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await fetchStockDetail(code);
        if (!cancelled) {
          setInfo(detail.info);
          setQuote(detail.quote);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    loadKline();
  }, [loadKline]);

  const up = (quote?.changePct ?? 0) >= 0;
  const quoteColor = up ? "text-red-400" : "text-green-400";

  return (
    <div className="h-[calc(100vh-52px)] overflow-y-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300"
        >
          ← 返回
        </button>
        <h1 className="text-lg font-bold text-gray-100">
          {info?.name || code}
          <span className="ml-2 font-mono text-sm text-gray-500">{code}</span>
        </h1>
        {info?.board && (
          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/40 text-blue-300">
            {info.board}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">最新价</p>
          <p className={`text-xl font-mono font-semibold ${quoteColor}`}>
            {quote ? quote.price.toFixed(2) : "--"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">涨跌幅</p>
          <p className={`text-xl font-mono font-semibold ${quoteColor}`}>
            {quote ? `${quote.changePct.toFixed(2)}%` : "--"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">成交量</p>
          <p className="text-xl font-mono font-semibold text-gray-200">
            {quote ? `${fmtAmount(quote.volume)} 手` : "--"}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">成交额</p>
          <p className="text-xl font-mono font-semibold text-gray-200">
            {quote?.amount ? fmtAmount(quote.amount) : "--"}
          </p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-4 flex-wrap text-sm">
        <span className="text-gray-500">市场：{info?.market || "--"}</span>
        <span className="text-gray-500">行业：{info?.industry || "--"}</span>
        {quote && (
          <>
            <span className="text-gray-500">
              最高：<span className="font-mono text-gray-200">{quote.high.toFixed(2)}</span>
            </span>
            <span className="text-gray-500">
              最低：<span className="font-mono text-gray-200">{quote.low.toFixed(2)}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
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

      {error && <p className="text-sm text-red-400">{error}</p>}

      {!error && klineData.length > 0 && (
        <>
          <StockChart klineData={klineData} indicators={[]} />
          <VolumeChart klineData={klineData} indicators={[]} />
        </>
      )}
      {!error && loading && (
        <div className="text-sm text-gray-400 py-10 text-center">加载中...</div>
      )}
      {!error && !loading && klineData.length === 0 && (
        <div className="text-sm text-gray-500 py-10 text-center">暂无行情数据</div>
      )}
    </div>
  );
}
