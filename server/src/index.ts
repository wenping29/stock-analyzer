import express from "express";
import cors from "cors";
import { stockRouter } from "./routes/stock";
import { indicatorsRouter } from "./routes/indicators";
import { screeningRouter } from "./routes/screening";
import { backtestingRouter } from "./routes/backtesting";
import { optimizationRouter } from "./routes/optimization";
import { monitoringRouter } from "./routes/monitoring";
import { marketRouter } from "./routes/market";
import { monitoringScheduler } from "./monitoring/scheduler";
import { realtimeQuotes } from "./services/realtime";
import { startRealtimeServer } from "./realtime/server";

const app = express();
const PORT = process.env.PORT || 3001;

// Disable ETag to prevent 304 caching issues with dynamic data
app.set("etag", false);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/stock", stockRouter);
app.use("/api/indicators", indicatorsRouter);
app.use("/api/screening", screeningRouter);
app.use("/api/backtesting", backtestingRouter);
app.use("/api/optimization", optimizationRouter);
app.use("/api/monitoring", monitoringRouter);
app.use("/api/market", marketRouter);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Start monitoring scheduler after server is ready
  monitoringScheduler.start().catch((e) => {
    console.error("[monitor] Failed to start scheduler:", e.message);
  });
});

// Start realtime quotes service on a separate port
startRealtimeServer();
realtimeQuotes.start().catch((e) => {
  console.error("[realtime] Failed to start quote service:", e.message);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  monitoringScheduler.stop();
  realtimeQuotes.stop();
  server.close();
});
