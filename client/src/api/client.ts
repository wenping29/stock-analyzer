import axios from "axios";
import type {
  KlineData,
  KlinePeriod,
  StockInfo,
  IndicatorResult,
  RuleGroup,
  ScreeningResult,
  PresetInfo,
  BacktestConfig,
  BacktestResult,
  PerformanceMetrics,
  Trade,
  OptimizationConfig,
  OptimizationResult,
  WalkForwardConfig,
  WalkForwardResult,
  RealtimeQuote,
  MacroIndicator,
} from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
});

export type StockListType = "all" | "a" | "b" | "sh" | "sz" | "bj" | "chinext" | "star" | "neeq";

export async function fetchStockList(type: StockListType = "all"): Promise<StockInfo[]> {
  const { data } = await api.get("/stock/list", { params: { type } });
  return data.data;
}

export async function searchStock(q: string): Promise<StockInfo[]> {
  const { data } = await api.get("/stock/search", { params: { q } });
  return data.data;
}

export async function fetchStockDetail(
  code: string
): Promise<{ info: StockInfo; quote: RealtimeQuote | null }> {
  const { data } = await api.get(`/stock/${code}`);
  return data.data;
}

export async function fetchMarketIndexes(): Promise<RealtimeQuote[]> {
  const { data } = await api.get("/market/indexes");
  return data.data;
}

export async function fetchMacroIndicators(): Promise<MacroIndicator[]> {
  const { data } = await api.get("/market/macro");
  return data.data;
}

export async function fetchUsRateHistory(
  maturity: string,
  start?: string,
  end?: string
): Promise<{ date: string; rate: number }[]> {
  const { data } = await api.get(`/market/us-rates/${maturity}`, {
    params: { start, end },
  });
  return data.data;
}

export async function fetchCnRateHistory(
  type: string,
  start?: string,
  end?: string
): Promise<{ date: string; rate: number }[]> {
  const { data } = await api.get(`/market/cn-rates/${type}`, {
    params: { start, end },
  });
  return data.data;
}

export async function fetchIndexKline(
  code: string,
  start: string,
  end: string,
  period: KlinePeriod = "daily"
): Promise<KlineData[]> {
  const { data } = await api.get(`/market/indexes/${code}/kline`, {
    params: { start, end, period },
  });
  return data.data;
}

export async function fetchKline(
  code: string,
  start: string,
  end: string,
  period: KlinePeriod = "daily",
  adjust = "qfq"
): Promise<KlineData[]> {
  const { data } = await api.get(`/stock/${code}/kline`, {
    params: { start, end, period, adjust },
  });
  return data.data;
}

export async function computeIndicators(
  klineData: KlineData[],
  indicators: { name: string; params: Record<string, number> }[]
): Promise<IndicatorResult[]> {
  const { data } = await api.post("/indicators/compute", {
    klineData,
    indicators,
  });
  return data.data;
}

export async function runScreening(params: {
  stockPool: string;
  rules: RuleGroup;
  startDate: string;
  endDate: string;
  period?: KlinePeriod;
}): Promise<{ data: ScreeningResult[]; meta: { total: number; matched: number } }> {
  const resp = await api.post("/screening/run", params);
  return { data: resp.data.data, meta: resp.data.meta };
}

export async function fetchPresets(): Promise<PresetInfo[]> {
  const { data } = await api.get("/screening/presets");
  return data.data;
}

export async function loadPreset(name: string): Promise<RuleGroup> {
  const { data } = await api.get(`/screening/presets/${name}`);
  return data.data.rules;
}

// ---- Backtesting ----

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult & { id: string }> {
  const { data } = await api.post("/backtesting/run", config);
  return data.data;
}

export async function getBacktestResults(): Promise<{ id: string; name: string; created_at: string }[]> {
  const { data } = await api.get("/backtesting/results");
  return data.data;
}

export async function getBacktestResult(id: string): Promise<{
  id: string; name: string; config: BacktestConfig;
  metrics: PerformanceMetrics; equityCurve: { date: string; value: number }[];
  trades: Trade[];
}> {
  const { data } = await api.get(`/backtesting/results/${id}`);
  return data.data;
}

// ---- Optimization ----

export async function runGridSearch(config: OptimizationConfig): Promise<{ data: OptimizationResult[]; meta: any }> {
  const resp = await api.post("/optimization/grid-search", config);
  return { data: resp.data.data, meta: resp.data.meta };
}

export async function runWalkForward(config: WalkForwardConfig): Promise<{ data: WalkForwardResult[]; meta: any }> {
  const resp = await api.post("/optimization/walk-forward", config);
  return { data: resp.data.data, meta: resp.data.meta };
}

export async function fetchIndexPeriodData(
  period: string,
  codes?: string[],
  start?: string,
  end?: string
): Promise<Record<string, { name: string; data: { date: string; open: number; high: number; low: number; close: number; volume: number; amount: number }[] }>> {
  const { data } = await api.get(`/market/index-data/${period}`, {
    params: { codes: codes?.join(","), start, end },
  });
  return data.data;
}

export async function fetchFxCnyUsd(
  period: string,
  start?: string,
  end?: string
): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
  const { data } = await api.get(`/market/fx-cny-usd/${period}`, {
    params: { start, end },
  });
  return data.data;
}

export async function fetchGoldPrice(
  period: string,
  start?: string,
  end?: string
): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
  const { data } = await api.get(`/market/gold-price/${period}`, {
    params: { start, end },
  });
  return data.data;
}

export async function fetchCrudeOil(
  period: string,
  start?: string,
  end?: string
): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
  const { data } = await api.get(`/market/crude-oil/${period}`, {
    params: { start, end },
  });
  return data.data;
}
