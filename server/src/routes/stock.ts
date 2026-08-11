import { Router, Request, Response } from "express";
import type { StockInfo } from "@shared/types";
import { fetcher } from "../services/fetcher";
import { cacheManager } from "../services/cache";
import { getFilteredStockList } from "../services/stockList";
import { db } from "../services/database";
import { realtimeQuotes } from "../services/realtime";

export const stockRouter = Router();

function boardOf(code: string): string {
  if (/^688|^689/.test(code)) return "科创板";
  if (/^300|^301/.test(code)) return "创业板";
  if (/^6/.test(code)) return "沪市A股";
  if (/^[03]/.test(code)) return "深市A股";
  if (/^920|^8/.test(code)) return "北交所";
  if (/^900/.test(code)) return "沪市B股";
  if (/^200/.test(code)) return "深市B股";
  if (/^4/.test(code)) return "新三板";
  return "其他";
}

// GET /api/stock/list?type=all|a|b|sh|sz|bj|chinext|star|neeq — 从本地数据库获取股票列表
stockRouter.get("/list", async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || "all";
    const stocks = await getFilteredStockList(type);
    res.json({ success: true, data: stocks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stock/search?q=60051 — 搜索股票
stockRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const stocks = await getFilteredStockList();
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

// GET /api/stock/:code — 股票详情（基本信息 + 实时行情）
stockRouter.get("/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    await db.init();
    let info = db.getStockByCode(code);
    if (!info) {
      info = { code, name: code, market: undefined, industry: undefined } as StockInfo;
    }
    info.board = boardOf(code);
    const quote = realtimeQuotes.get(code) || null;
    res.json({ success: true, data: { info, quote } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
