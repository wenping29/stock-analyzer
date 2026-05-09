import { Router, Request, Response } from "express";
import type { MonitorJob, WebhookConfig } from "@shared/types";
import { monitoringScheduler } from "../monitoring/scheduler";
import { webhookNotifier } from "../monitoring/webhook";
import { db } from "../services/database";

export const monitoringRouter = Router();

// GET /api/monitoring/jobs
monitoringRouter.get("/jobs", async (_req: Request, res: Response) => {
  try {
    await db.init();
    const jobs = monitoringScheduler.getJobs();
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/monitoring/jobs
monitoringRouter.post("/jobs", async (req: Request, res: Response) => {
  try {
    const config = req.body as MonitorJob;

    if (!config.name || !config.cron) {
      return res.status(400).json({ success: false, error: "缺少必要参数: name, cron" });
    }

    // Generate ID if not provided
    if (!config.id) config.id = `monitor_${Date.now()}`;

    await db.init();
    db.saveMonitorJob(config);
    monitoringScheduler.addJob(config);

    res.json({ success: true, data: { id: config.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/monitoring/jobs/:id
monitoringRouter.delete("/jobs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    monitoringScheduler.removeJob(id);
    await db.init();
    db.deleteMonitorJob(id);
    res.json({ success: true, data: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/monitoring/jobs/:id/run — manual trigger
monitoringRouter.post("/jobs/:id/run", async (req: Request, res: Response) => {
  try {
    // Find the job config
    const jobs = db.getMonitorJobs();
    const job = jobs.find((j) => j.id === req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: "监控任务不存在" });
    }
    // Run async, don't wait
    monitoringScheduler.executeRun(job).catch((e) => {
      console.error(`[monitor] manual run failed:`, e.message);
    });
    res.json({ success: true, data: { message: "已触发执行" } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/monitoring/test-webhook
monitoringRouter.post("/test-webhook", async (req: Request, res: Response) => {
  try {
    const { url, type } = req.body as { url: string; type?: string };

    if (!url) {
      return res.status(400).json({ success: false, error: "缺少 webhook URL" });
    }

    const config: WebhookConfig = {
      type: (type as any) || "wecom",
      url,
    };

    const ok = await webhookNotifier.send(config, {
      title: "测试消息",
      timestamp: new Date().toLocaleString("zh-CN"),
      entrySignals: [{ code: "000001", name: "测试股票", close: 10.50, changePct: 2.5 }],
    });

    if (ok) {
      res.json({ success: true, data: { message: "测试消息已发送" } });
    } else {
      res.status(500).json({ success: false, error: "发送失败，请检查URL和权限" });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
