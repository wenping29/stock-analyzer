import express from "express";
import cors from "cors";
import { stockRouter } from "./routes/stock";
import { indicatorsRouter } from "./routes/indicators";
import { screeningRouter } from "./routes/screening";
import { backtestingRouter } from "./routes/backtesting";
import { optimizationRouter } from "./routes/optimization";
import { monitoringRouter } from "./routes/monitoring";
import { marketRouter } from "./routes/market";

const app = express();
const PORT = process.env.PORT || 3001;

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
});

process.on("SIGTERM", () => {
  server.close();
});
