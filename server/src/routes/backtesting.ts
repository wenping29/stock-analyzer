import { Router, Request, Response } from "express";
import type { BacktestConfig } from "@shared/types";
import { backtestingEngine } from "../backtesting/engine";
import { fetcher } from "../services/fetcher";
import { db } from "../services/database";

export const backtestingRouter = Router();

// POST /api/backtesting/run
backtestingRouter.post("/run", async (req: Request, res: Response) => {
  try {
    const config = req.body as BacktestConfig;

    if (!config.code || !config.startDate || !config.endDate || !config.entryRules) {
      return res.status(400).json({ success: false, error: "缺少必要参数: code, startDate, endDate, entryRules" });
    }

    // Fetch kline data (API first, DB fallback handled inside fetcher)
    const klineData = await fetcher.fetchKline(
      config.code,
      config.startDate,
      config.endDate,
      config.period || "daily",
      "qfq"
    );

    if (!klineData || klineData.length < 60) {
      return res.status(400).json({ success: false, error: `数据不足 (${klineData?.length || 0}条)，至少需要60个交易日` });
    }

    // Run backtest
    const result = backtestingEngine.run(config, klineData);

    // Save to database
    const id = `bt_${Date.now()}_${config.code}`;
    const name = `${config.name || config.code} ${config.startDate}~${config.endDate}`;
    await db.init();
    db.saveBacktestResult(id, name, config, result.metrics, result.equityCurve);
    if (result.trades.length > 0) {
      db.saveTrades(id, result.trades);
    }

    res.json({ success: true, data: { id, ...result } });
  } catch (err: any) {
    console.error("[backtesting] run error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backtesting/results — list past backtest runs
backtestingRouter.get("/results", async (_req: Request, res: Response) => {
  try {
    await db.init();
    const results = db.listBacktestResults();
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/backtesting/results/:id — get full result with trades
backtestingRouter.get("/results/:id", async (req: Request, res: Response) => {
  try {
    await db.init();
    const result = db.getBacktestResult(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: "回测结果不存在" });
    }
    const trades = db.getTrades(req.params.id);

    res.json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        config: JSON.parse(result.config),
        metrics: JSON.parse(result.metrics),
        equityCurve: JSON.parse(result.equity_curve),
        trades,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
