// ============================================================
// Shared types for stock-analyzer (client + server)
// ============================================================

// ---- K-line Data ----

export type KlinePeriod = "60min" | "daily" | "weekly" | "monthly";

export interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

// ---- Stock Info ----

export interface StockInfo {
  code: string;
  name: string;
  market?: string;
  industry?: string;
}

// ---- Indicators ----

export interface Signal {
  date: string;
  type: "buy" | "sell";
  description: string;
}

export interface IndicatorResult {
  name: string;
  category: string;
  params: Record<string, number>;
  columns: string[];
  values: number[][];
  signals: Signal[];
}

export interface Indicator {
  name: string;
  category: "trend" | "oscillator" | "volume" | "volatility";
  params: Record<string, number>;
  compute(data: KlineData[]): IndicatorResult;
}

// ---- Screening Rules ----

export interface RuleCondition {
  indicator: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "cross_above" | "cross_below";
  value: number;
  params: Record<string, number>;
}

export interface RuleGroup {
  logic: "AND" | "OR";
  conditions: (RuleCondition | RuleGroup)[];
}

// ---- Screening Results ----

export interface ScreeningResult {
  code: string;
  name: string;
  close: number;
  changePct: number;
  indicators: Record<string, number>;
}

export interface PresetInfo {
  key: string;
  name: string;
  description: string;
}

export interface ScreeningResponse {
  data: ScreeningResult[];
  meta: { total: number; matched: number };
}

// ---- Exit Rules (Phase 2.1) ----

export interface ExitRules {
  stopLossPct?: number;           // fixed % stop loss (e.g., 5 = -5%)
  stopLossAtrMultiplier?: number; // ATR-based stop (e.g., 2 = 2*ATR)
  takeProfitPct?: number;         // fixed % take profit (e.g., 10 = +10%)
  exitIndicator?: RuleGroup;      // indicator-based exit (e.g., MA deadcross)
}

// ---- Position Sizing (Phase 2.1) ----

export type PositionMethod = "fixed" | "volatility_weighted";

// ---- Backtesting (Phase 2.1) ----

export interface BacktestConfig {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  period: KlinePeriod;
  initialCapital: number;
  entryRules: RuleGroup;
  exitRules: ExitRules;
  positionMethod: PositionMethod;
  positionSizing: number;   // fixed: fraction (0.1=10%), vol-weighted: base pct
  commission: number;       // e.g., 0.0003 (0.03%)
  slippage: number;         // e.g., 0.001 (0.1%)
}

export interface Trade {
  code: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPct: number;
  exitReason: string;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  sharpeRatio: number;
  sortinoRatio: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  calmarRatio: number;
  totalTrades: number;
}

export interface BacktestResult {
  config: BacktestConfig;
  trades: Trade[];
  equityCurve: { date: string; value: number }[];
  metrics: PerformanceMetrics;
}

// ---- Parameter Optimization (Phase 2.2) ----

export interface ParamRange {
  indicator: string;
  param: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizationConfig {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  period: KlinePeriod;
  baseConfig: Omit<BacktestConfig, "code" | "name" | "startDate" | "endDate" | "period">;
  paramRanges: ParamRange[];
  metric: keyof PerformanceMetrics;
  topN: number;
}

export interface OptimizationResult {
  params: Record<string, number>;
  metrics: PerformanceMetrics;
  totalTrades: number;
}

export interface WalkForwardWindow {
  insampleStart: string;
  insampleEnd: string;
  outsampleStart: string;
  outsampleEnd: string;
}

export interface WalkForwardResult {
  window: WalkForwardWindow;
  insampleBest: OptimizationResult;
  outsampleMetrics: PerformanceMetrics;
  outsampleTrades: number;
  overfit: boolean;
}

export interface WalkForwardConfig {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  period: KlinePeriod;
  baseConfig: Omit<BacktestConfig, "code" | "name" | "startDate" | "endDate" | "period">;
  paramRanges: ParamRange[];
  metric: keyof PerformanceMetrics;
  topN: number;
  insampleDays: number;   // e.g., 504 (2 years)
  outsampleDays: number;   // e.g., 252 (1 year)
}

// ---- Live Monitoring (Phase 2.3) ----

export type WebhookType = "wecom" | "dingtalk" | "generic";

export interface WebhookConfig {
  type: WebhookType;
  url: string;
  secret?: string;
}

export interface MonitorJob {
  id: string;
  name: string;
  cron: string;
  stockPool: string[];       // empty = all A shares
  entryRules: RuleGroup;
  exitRules: ExitRules;
  watchlist: string[];       // codes to monitor for exit signals
  webhooks: WebhookConfig[];
  enabled: boolean;
}

export type MarketState = "trend_up" | "trend_down" | "ranging";
