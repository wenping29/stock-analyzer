import { Router, Request, Response } from "express";
import { fetcher } from "../services/fetcher";
import { cacheManager } from "../services/cache";
import { getFilteredStockList } from "../services/stockList";

export const stockRouter = Router();

const STOCK_LIST_CACHE_KEY = "stock_list";

// GET /api/stock/list — 获取股票列表
stockRouter.get("/list", async (_req: Request, res: Response) => {
  try {
    const stocks = await cacheManager.getOrFetch(
      STOCK_LIST_CACHE_KEY,
      () => getFilteredStockList(),
      60 * 60 * 1000 // 1h TTL
    );
    res.json({ success: true, data: stocks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stock/search?q=60051 — 搜索股票
stockRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const stocks = await cacheManager.getOrFetch(
      STOCK_LIST_CACHE_KEY,
      () => getFilteredStockList(),
      60 * 60 * 1000
    );
    const results = stocks.filter(
      (s) => s.code.includes(q) || s.name.includes(q)
    );
    res.json({ success: true, data: results.slice(0, 20) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stock/:code/kline?start=2024-01-01&end=2024-12-31&period=daily&adjust=qfq
stockRouter.get("/:code/kline", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { start = "2024-01-01", end = "", period = "daily", adjust = "qfq" } = req.query;
    const endDate = (end as string) || new Date().toISOString().slice(0, 10);
    const periodStr = period as string;
    const cacheKey = `kline_${code}_${periodStr}_${start}_${endDate}_${adjust}`;

    const data = await cacheManager.getOrFetch(
      cacheKey,
      () => fetcher.fetchKline(code, start as string, endDate, periodStr as any, adjust as string),
      24 * 60 * 60 * 1000
    );
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
