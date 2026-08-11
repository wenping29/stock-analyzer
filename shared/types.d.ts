export type KlinePeriod = "60min" | "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export interface KlineData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    amount: number;
}
export interface StockInfo {
    code: string;
    name: string;
    market?: string;
    board?: string;
    industry?: string;
}
export interface RealtimeQuote {
    code: string;
    name: string;
    market?: string;
    price: number;
    changePct: number;
    volume: number;
    high: number;
    low: number;
    amount?: number;
}
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
    meta: {
        total: number;
        matched: number;
    };
}
export interface ExitRules {
    stopLossPct?: number;
    stopLossAtrMultiplier?: number;
    takeProfitPct?: number;
    exitIndicator?: RuleGroup;
}
export type PositionMethod = "fixed" | "volatility_weighted";
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
    positionSizing: number;
    commission: number;
    slippage: number;
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
    equityCurve: {
        date: string;
        value: number;
    }[];
    metrics: PerformanceMetrics;
}
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
    insampleDays: number;
    outsampleDays: number;
}
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
    stockPool: string[];
    entryRules: RuleGroup;
    exitRules: ExitRules;
    watchlist: string[];
    webhooks: WebhookConfig[];
    enabled: boolean;
}
export type MarketState = "trend_up" | "trend_down" | "ranging";
