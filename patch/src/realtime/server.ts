import express from "express";
import cors from "cors";
import { realtimeQuotes } from "../services/realtime";

const PORT = Number(process.env.REALTIME_PORT) || 3012;

export function startRealtimeServer(): void {
  const app = express();
  app.set("etag", false);
  app.use(cors());

  app.get("/health", (_req, res) => {
    res.json({ success: true, status: realtimeQuotes.getStatus() });
  });

  // GET /api/quote/all — 全部股票实时行情
  app.get("/api/quote/all", (_req, res) => {
    res.json({
      success: true,
      data: realtimeQuotes.getAll(),
      meta: realtimeQuotes.getStatus(),
    });
  });

  // GET /api/quote/:code — 单只股票实时行情
  app.get("/api/quote/:code", (req, res) => {
    const quote = realtimeQuotes.get(req.params.code);
    if (!quote) {
      res.status(404).json({ success: false, error: `no quote for ${req.params.code}` });
      return;
    }
    res.json({ success: true, data: quote });
  });

  // POST /api/quote/refresh — 手动触发全量刷新
  app.post("/api/quote/refresh", async (_req, res) => {
    try {
      const count = await realtimeQuotes.refresh();
      res.json({ success: true, data: { count }, meta: realtimeQuotes.getStatus() });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`Realtime quotes server running on http://localhost:${PORT}`);
  });

  const shutdown = (): void => {
    server.close();
  };
  process.on("SIGTERM", shutdown);
}
