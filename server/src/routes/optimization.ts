import { Router, Request, Response } from "express";
import type { OptimizationConfig, WalkForwardConfig } from "@shared/types";
import { gridSearchEngine } from "../optimization/grid-search";
import { walkForwardOptimizer } from "../optimization/walk-forward";
import { fetcher } from "../services/fetcher";

export const optimizationRouter = Router();

// POST /api/optimization/grid-search
optimizationRouter.post("/grid-search", async (req: Request, res: Response) => {
  try {
    const config = req.body as OptimizationConfig;

    if (!config.code || !config.paramRanges || config.paramRanges.length === 0) {
      return res.status(400).json({ success: false, error: "缺少必要参数: code, paramRanges" });
    }

    const klineData = await fetcher.fetchKline(
      config.code,
      config.startDate,
      config.endDate,
      config.period || "daily",
      "qfq"
    );

    if (!klineData || klineData.length < 60) {
      return res.status(400).json({ success: false, error: `数据不足 (${klineData?.length || 0}条)` });
    }

    const results = gridSearchEngine.run(config, klineData);

    res.json({
      success: true,
      data: results,
      meta: { totalCombinations: results.length, metric: config.metric },
    });
  } catch (err: any) {
    console.error("[optimization] error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/optimization/walk-forward
optimizationRouter.post("/walk-forward", async (req: Request, res: Response) => {
  try {
    const config = req.body as WalkForwardConfig;

    if (!config.code || !config.paramRanges || config.paramRanges.length === 0) {
      return res.status(400).json({ success: false, error: "缺少必要参数: code, paramRanges" });
    }

    const klineData = await fetcher.fetchKline(
      config.code,
      config.startDate,
      config.endDate,
      config.period || "daily",
      "qfq"
    );

    if (!klineData || klineData.length < (config.insampleDays + config.outsampleDays)) {
      return res.status(400).json({
        success: false,
        error: `数据不足 (${klineData?.length || 0}条)，需要至少 ${config.insampleDays + config.outsampleDays} 条`,
      });
    }

    const results = walkForwardOptimizer.run(config, klineData);

    const overfitWindows = results.filter((r) => r.overfit).length;

    res.json({
      success: true,
      data: results,
      meta: { totalWindows: results.length, overfitWindows },
    });
  } catch (err: any) {
    console.error("[optimization] error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
