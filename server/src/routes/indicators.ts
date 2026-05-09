import { Router, Request, Response } from "express";
import type { KlineData } from "@shared/types";
import { getIndicator, listIndicators } from "../indicators";

export const indicatorsRouter = Router();

// GET /api/indicators — 列出所有可用指标
indicatorsRouter.get("/", (_req: Request, res: Response) => {
  res.json({ success: true, data: listIndicators() });
});

// POST /api/indicators/compute — 计算指标
indicatorsRouter.post("/compute", (req: Request, res: Response) => {
  try {
    const { klineData, indicators } = req.body as {
      klineData: KlineData[];
      indicators: { name: string; params?: Record<string, number> }[];
    };

    if (!klineData || !Array.isArray(klineData)) {
      return res.status(400).json({ success: false, error: "klineData is required" });
    }

    const results = (indicators || []).map(({ name, params }) => {
      const indicator = getIndicator(name, params);
      if (!indicator) return { name, error: `Unknown indicator: ${name}` };
      return indicator.compute(klineData);
    });

    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
