import { Router, Request, Response } from "express";
import { screeningEngine } from "../screening/engine";
import { presetManager } from "../screening/presets";
import { evaluate, validateRules } from "../screening/rules";
import { fetcher } from "../services/fetcher";
import { getFilteredStockList } from "../services/stockList";
import { cacheManager } from "../services/cache";

export const screeningRouter = Router();

// GET /api/screening/presets
screeningRouter.get("/presets", (_req: Request, res: Response) => {
  res.json({ success: true, data: presetManager.list() });
});

// GET /api/screening/presets/:key
screeningRouter.get("/presets/:key", (req: Request, res: Response) => {
  const preset = presetManager.getFull(req.params.key);
  if (!preset) return res.status(404).json({ success: false, error: "Preset not found" });
  res.json({ success: true, data: preset });
});

// POST /api/screening/run
screeningRouter.post("/run", async (req: Request, res: Response) => {
  try {
    const { stockPool, rules, startDate, endDate, period = "daily" } = req.body;

    const validation = validateRules(rules);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.errors.join("; ") });
    }

    // Get stock pool
    let stocks: { code: string; name: string }[];
    if (stockPool === "沪深300" || stockPool === "中证500" || stockPool === "创业板") {
      stocks = await cacheManager.getOrFetch("stock_list", () => getFilteredStockList(), 60 * 60 * 1000);
      if (stockPool === "创业板") stocks = stocks.filter((s) => s.code.startsWith("3"));
      stocks = stocks.slice(0, 500);
    } else {
      stocks = await cacheManager.getOrFetch("stock_list", () => getFilteredStockList(), 60 * 60 * 1000);
    }

    const results = await screeningEngine.screen(stocks, rules, startDate, endDate, period);

    // Sort by changePct descending by default
    results.sort((a, b) => b.changePct - a.changePct);

    res.json({ success: true, data: results, meta: { total: stocks.length, matched: results.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/screening/test — test rules on a single stock
screeningRouter.post("/test", async (req: Request, res: Response) => {
  try {
    const { code, rules, startDate, endDate, period = "daily" } = req.body;

    const cacheKey = `kline_${code}_${period}_${startDate}_${endDate}_qfq`;
    const data = await cacheManager.getOrFetch(
      cacheKey,
      () => fetcher.fetchKline(code, startDate, endDate, period as any, "qfq"),
      24 * 60 * 60 * 1000
    );

    if (!data || data.length < 30) {
      return res.json({ success: true, data: { passed: false, reason: "数据不足" } });
    }

    const passed = evaluate(data, rules);
    res.json({ success: true, data: { passed, dataLength: data.length } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
