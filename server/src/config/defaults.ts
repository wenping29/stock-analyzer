export const INDICATOR_DEFAULTS: Record<string, Record<string, number>> = {
  MA: { period: 20 },
  EMA: { period: 20 },
  MACD: { fast: 12, slow: 26, signal: 9 },
  BOLL: { period: 20, stddev: 2 },
  RSI: { period: 14 },
  KDJ: { n: 9, k: 3, d: 3 },
  WR: { period: 14 },
  VOL: { period: 5 },
  OBV: { maPeriod: 20 },
  VolumeRatio: { period: 5 },
  ATR: { period: 14 },
};

export const SCREENING_PRESETS: Record<string, any> = {
  trend_following: {
    name: "趋势追踪",
    description: "短期上涨趋势明确且量能支撑",
    rules: {
      logic: "AND",
      conditions: [
        { indicator: "EMA", operator: ">", value: "EMA_20", params: { period: 5 } },
        { indicator: "MACD", operator: "cross_above", value: 0, params: {} },
        { indicator: "VOL", operator: ">", value: 1.2, params: { period: 5 } },
      ],
    },
  },
  oversold_rebound: {
    name: "超跌反弹",
    description: "超卖且资金开始流入",
    rules: {
      logic: "AND",
      conditions: [
        { indicator: "RSI", operator: "<", value: 25, params: { period: 12 } },
        { indicator: "OBV", operator: "cross_above", value: 0, params: { maPeriod: 20 } },
        { indicator: "WR", operator: ">", value: 80, params: { period: 14 } },
      ],
    },
  },
  breakout: {
    name: "放量突破",
    description: "价格突破布林带上轨且放量",
    rules: {
      logic: "AND",
      conditions: [
        { indicator: "BOLL", operator: ">", value: 0, params: { period: 20, stddev: 2 } },
        { indicator: "VolumeRatio", operator: ">", value: 2, params: { period: 5 } },
      ],
    },
  },
};
