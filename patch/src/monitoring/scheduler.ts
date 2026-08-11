import { CronJob } from "cron";
import type { MonitorJob } from "@shared/types";
import { db } from "../services/database";
import { fetcher } from "../services/fetcher";
import { evaluate } from "../screening/rules";
import { getFilteredStockList } from "../services/stockList";
import { shouldExit } from "../backtesting/exit-rules";
import { webhookNotifier, WebhookMessage } from "./webhook";

export class MonitoringScheduler {
  private jobs: Map<string, CronJob> = new Map();

  async start(): Promise<void> {
    await db.init();
    const savedJobs = db.getMonitorJobs();
    for (const job of savedJobs) {
      if (job.enabled) this.addJob(job);
    }
    console.log(`[monitor] Loaded ${this.jobs.size} monitoring jobs`);
  }

  addJob(config: MonitorJob): void {
    if (this.jobs.has(config.id)) {
      this.removeJob(config.id);
    }

    try {
      const job = new CronJob(config.cron, () => {
        this.executeRun(config).catch((e) => {
          console.error(`[monitor] job "${config.name}" failed:`, e.message);
        });
      });

      job.start();
      this.jobs.set(config.id, job);
      console.log(`[monitor] Started job "${config.name}" (${config.cron})`);
    } catch (e: any) {
      console.error(`[monitor] Failed to create job "${config.name}":`, e.message);
    }
  }

  removeJob(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }
  }

  async executeRun(config: MonitorJob): Promise<void> {
    console.log(`[monitor] Running job "${config.name}"...`);

    // 1. Get stock pool
    let stockPool: { code: string; name: string }[];
    if (config.stockPool.length > 0) {
      stockPool = config.stockPool.map((code) => ({ code, name: code }));
    } else {
      try {
        stockPool = await getFilteredStockList();
      } catch {
        console.error("[monitor] Failed to get stock list");
        return;
      }
    }

    // 2. Scan for entry signals (limit to 200 stocks for performance)
    const entrySignals: { code: string; name: string; close: number; changePct: number }[] = [];
    const scanPool = stockPool.slice(0, 200);

    for (const stock of scanPool) {
      try {
        const data = await fetcher.fetchKline(stock.code, "2024-01-01", new Date().toISOString().slice(0, 10), "daily", "qfq");
        if (!data || data.length < 60) continue;

        if (evaluate(data, config.entryRules)) {
          const last = data[data.length - 1];
          const prev = data[data.length - 2];
          entrySignals.push({
            code: stock.code,
            name: stock.name,
            close: last.close,
            changePct: prev ? ((last.close - prev.close) / prev.close) * 100 : 0,
          });
        }
      } catch { /* skip individual stock failures */ }
    }

    // 3. Scan watchlist for exit signals
    const exitSignals: { code: string; signal: string }[] = [];
    for (const code of config.watchlist) {
      try {
        const data = await fetcher.fetchKline(code, "2024-01-01", new Date().toISOString().slice(0, 10), "daily", "qfq");
        if (!data || data.length < 60) continue;

        // Check exit on the latest position (assume bought 60 days ago)
        const exitResult = shouldExit(data, data.length - 60, data.length - 1, data[data.length - 60].close, config.exitRules);
        if (exitResult.exit) {
          exitSignals.push({ code, signal: exitResult.reason });
        }
      } catch { /* skip */ }
    }

    // 4. Save results
    db.saveMonitoringRun(config.id, entrySignals, exitSignals);

    // 5. Send webhooks
    const message: WebhookMessage = {
      title: `${config.name} - 扫描结果`,
      timestamp: new Date().toLocaleString("zh-CN"),
      entrySignals,
      exitSignals,
    };

    for (const webhook of config.webhooks) {
      const ok = await webhookNotifier.send(webhook, message);
      if (!ok) console.error(`[monitor] Webhook to ${webhook.url} failed`);
    }

    console.log(`[monitor] Job "${config.name}" done: ${entrySignals.length} entries, ${exitSignals.length} exits`);
  }

  getJobs(): { id: string; name: string; cron: string; enabled: boolean }[] {
    const jobs: { id: string; name: string; cron: string; enabled: boolean }[] = [];
    const savedJobs = db.getMonitorJobs();
    for (const j of savedJobs) {
      jobs.push({ id: j.id, name: j.name, cron: j.cron, enabled: j.enabled });
    }
    return jobs;
  }

  stop(): void {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    console.log("[monitor] All jobs stopped");
  }
}

export const monitoringScheduler = new MonitoringScheduler();
