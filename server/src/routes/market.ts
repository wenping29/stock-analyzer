import { Router, Request, Response } from "express";
import { fetcher } from "../services/fetcher";
import { cacheManager } from "../services/cache";
import { MARKET_INDEXES } from "../services/marketIndex";
import { db } from "../services/database";

export const marketRouter = Router();

// GET /api/market/indexes — 大盘指数实时行情
marketRouter.get("/indexes", async (_req: Request, res: Response) => {
  try {
    const quotes = await cacheManager.getOrFetch(
      "market_index_quotes_v3",
      () => fetcher.fetchIndexQuote(MARKET_INDEXES.map((i) => i.code)),
      60 * 1000 // 1min TTL
    );
    const flows = await cacheManager.getOrFetch(
      "market_index_flow_v1",
      () => fetcher.fetchIndexCapitalFlow(MARKET_INDEXES.map((i) => i.code)),
      60 * 1000 // 1min TTL
    );
    // 名称以本地配置为准，避免外部接口编码问题导致的乱码
    const nameByCode = new Map(MARKET_INDEXES.map((i) => [i.code, i.name]));
    const data = quotes.map((q) => ({
      ...q,
      name: nameByCode.get(q.code) || q.name,
      mainInflow: flows.get(q.code),
    }));
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/macro — 宏观指标叠加标签（美债/汇率/原油/中债/利率）
marketRouter.get("/macro", async (_req: Request, res: Response) => {
  try {
    const data = await cacheManager.getOrFetch(
      "market_macro_v2",
      () => fetcher.fetchMacroIndicators(),
      60 * 1000 // 1min TTL
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/indexes/:code/kline?start=&end=&period= — 指数K线
marketRouter.get("/indexes/:code/kline", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { start = "2024-01-01", end = "", period = "daily" } = req.query;
    const endDate = (end as string) || new Date().toISOString().slice(0, 10);
    const periodStr = period as string;
    const cacheKey = `index_kline_${code}_${periodStr}_${start}_${endDate}`;

    const data = await cacheManager.getOrFetch(
      cacheKey,
      () => fetcher.fetchIndexKline(code, start as string, endDate, periodStr as any),
      24 * 60 * 60 * 1000
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/us-rates/:maturity?start=&end= — 美债利率历史
const VALID_MATURITIES = ["3M", "6M", "1Y", "10Y"];

marketRouter.get("/us-rates/:maturity", async (req: Request, res: Response) => {
  try {
    const { maturity } = req.params;
    if (!VALID_MATURITIES.includes(maturity)) {
      res.status(400).json({ success: false, error: `Invalid maturity. Valid values: ${VALID_MATURITIES.join(", ")}` });
      return;
    }
    const { start, end } = req.query;
    const cacheKey = `us_rates_${maturity}_${start || "all"}_${end || "all"}`;
    const data = await cacheManager.getOrFetch(
      cacheKey,
      async () => {
        await db.init();
        return db.getUsShortRates(maturity, start as string | undefined, end as string | undefined);
      },
      60 * 60 * 1000 // 1 hour TTL
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/cn-rates/:type?start=&end= — 人民币利率历史
const VALID_CN_RATE_TYPES = ["SHIBOR_ON", "SHIBOR_1W", "SHIBOR_2W", "SHIBOR_1M", "SHIBOR_3M", "SHIBOR_6M", "SHIBOR_9M", "SHIBOR_1Y", "CN_10Y"];

marketRouter.get("/cn-rates/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    if (!VALID_CN_RATE_TYPES.includes(type)) {
      res.status(400).json({ success: false, error: `Invalid type. Valid values: ${VALID_CN_RATE_TYPES.join(", ")}` });
      return;
    }
    const { start, end } = req.query;
    const cacheKey = `cn_rates_${type}_${start || "all"}_${end || "all"}`;
    const data = await cacheManager.getOrFetch(
      cacheKey,
      async () => {
        await db.init();
        return db.getCnRates(type, start as string | undefined, end as string | undefined);
      },
      60 * 60 * 1000 // 1 hour TTL
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/index-data/:period?codes=&start=&end= — 大盘指标周期数据
const VALID_INDEX_PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"];
const INDEX_NAME_MAP: Record<string, string> = {
  sh000001: "上证指数",
  sh000300: "沪深300",
  sz399006: "创业板指",
  sh000688: "科创50",
  bj899050: "北证50",
};

marketRouter.get("/index-data/:period", async (req: Request, res: Response) => {
  try {
    const { period } = req.params;
    if (!VALID_INDEX_PERIODS.includes(period)) {
      res.status(400).json({ success: false, error: `Invalid period. Valid values: ${VALID_INDEX_PERIODS.join(", ")}` });
      return;
    }
    const { codes, start, end } = req.query;
    const codeList = (codes as string)?.split(",").filter(Boolean) || Object.keys(INDEX_NAME_MAP);
    const cacheKey = `index_data_${period}_${codeList.join("|")}_${start || "all"}_${end || "all"}`;

    const data = await cacheManager.getOrFetch(
      cacheKey,
      async () => {
        await db.init();
        const results: Record<string, { name: string; data: any[] }> = {};
        for (const code of codeList) {
          const rows = db.getIndexPeriod(period, code, start as string | undefined, end as string | undefined);
          results[code] = { name: INDEX_NAME_MAP[code] || code, data: rows };
        }
        return results;
      },
      60 * 60 * 1000
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/market/fx-cny-usd/:period?start=&end= — 人民币/美元汇率
const VALID_FX_PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

marketRouter.get("/fx-cny-usd/:period", async (req: Request, res: Response) => {
  try {
    const { period } = req.params;
    if (!VALID_FX_PERIODS.includes(period)) {
      res.status(400).json({ success: false, error: `Invalid period. Valid values: ${VALID_FX_PERIODS.join(", ")}` });
      return;
    }
    const { start, end } = req.query;
    const cacheKey = `fx_cny_usd_${period}_${start || "all"}_${end || "all"}`;
    const data = await cacheManager.getOrFetch(
      cacheKey,
      async () => {
        await db.init();
        return db.getFxCnyUsd(period, start as string | undefined, end as string | undefined);
      },
      60 * 60 * 1000
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
