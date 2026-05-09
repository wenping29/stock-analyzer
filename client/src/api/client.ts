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
} from "../types";

const api = axios.create({ baseURL: "/api" });

export async function fetchStockList(): Promise<StockInfo[]> {
  const { data } = await api.get("/stock/list");
  return data.data;
}

export async function searchStock(q: string): Promise<StockInfo[]> {
  const { data } = await api.get("/stock/search", { params: { q } });
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
