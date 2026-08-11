import express from "express";
import cors from "cors";
import { monitoringScheduler } from "./monitoring/scheduler";
import { realtimeQuotes } from "./services/realtime";
import { startRealtimeServer } from "./realtime/server";

const app = express();
const PORT = process.env.PORT || 3011;

app.set("etag", false);
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    realtime: realtimeQuotes.getStatus(),
    monitor: monitoringScheduler.getJobs(),
  });
});

const server = app.listen(PORT, () => {
  console.log(`[patch] Server running on http://localhost:${PORT}`);

  // 1. 启动监控调度器 — 加载数据库中的定时任务并注册 CronJob
  monitoringScheduler.start().catch((e) => {
    console.error("[monitor] Failed to start scheduler:", e.message);
  });
});

// 2. 启动实时行情 HTTP 服务 (端口 3002)
startRealtimeServer();

// 3. 启动实时行情服务 — 立即获取全市场 A 股实时行情，之后每 60s 刷新
realtimeQuotes.start().catch((e) => {
  console.error("[realtime] Failed to start quote service:", e.message);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[patch] Shutting down...");
  monitoringScheduler.stop();
  realtimeQuotes.stop();
  server.close();
});
