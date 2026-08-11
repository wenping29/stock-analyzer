import { Router, Request, Response } from "express";
import { fetcher } from "../services/fetcher";
import { cacheManager } from "../services/cache";
import { MARKET_INDEXES } from "../services/marketIndex";

export const marketRouter = Router();

// GET /api/market/indexes — 大盘指数实时行情
marketRouter.get("/indexes", async (_req: Request, res: Response) => {
  try {
    const quotes = await cacheManager.getOrFetch(
      "market_index_quotes_v2",
      () => fetcher.fetchIndexQuote(MARKET_INDEXES.map((i) => i.code)),
      60 * 1000 // 1min TTL
    );
    // 名称以本地配置为准，避免外部接口编码问题导致的乱码
    const nameByCode = new Map(MARKET_INDEXES.map((i) => [i.code, i.name]));
    const data = quotes.map((q) => ({
      ...q,
      name: nameByCode.get(q.code) || q.name,
    }));
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
