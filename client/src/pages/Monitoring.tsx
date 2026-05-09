import { useState, useEffect, useCallback } from "react";
import type { MonitorJob, RuleGroup, WebhookConfig } from "../types";
import RuleBuilder from "../components/RuleBuilder";

const API_BASE = "/api/monitoring";

interface JobSummary {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
}

const DEFAULT_ENTRY_RULES: RuleGroup = {
  logic: "AND",
  conditions: [
    { indicator: "RSI", operator: "<", value: 25, params: { period: 14 } },
    { indicator: "OBV", operator: "cross_above", value: 0, params: { maPeriod: 20 } },
  ],
};

const CRON_PRESETS = [
  { label: "每交易日15:00", value: "0 15 * * 1-5" },
  { label: "每交易日09:30", value: "30 9 * * 1-5" },
  { label: "每日09:00", value: "0 9 * * *" },
  { label: "每2小时", value: "0 */2 * * *" },
  { label: "每30分钟", value: "*/30 * * * *" },
  { label: "每2分钟(测试)", value: "*/2 * * * *" },
];

export default function Monitoring() {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<MonitorJob | null>(null);
  const [editing, setEditing] = useState(false);

  // New job form
  const [name, setName] = useState("");
  const [cron, setCron] = useState("0 15 * * * 1-5");
  const [stockPool, setStockPool] = useState("");
  const [watchlist, setWatchlist] = useState("");
  const [entryRules, setEntryRules] = useState<RuleGroup>(DEFAULT_ENTRY_RULES);
  const [stopLossPct, setStopLossPct] = useState(5);
  const [takeProfitPct, setTakeProfitPct] = useState(15);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookType, setWebhookType] = useState<"wecom" | "dingtalk" | "generic">("wecom");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/jobs`);
      const data = await resp.json();
      if (data.success) setJobs(data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleCreate = async () => {
    if (!name) return;
    setLoading(true);
    setError("");

    const webhooks: WebhookConfig[] = webhookUrl
      ? [{ type: webhookType, url: webhookUrl }]
      : [];

    const job: MonitorJob = {
      id: "",
      name,
      cron,
      stockPool: stockPool.split(",").map((s) => s.trim()).filter(Boolean),
      entryRules,
      exitRules: { stopLossPct, takeProfitPct },
      watchlist: watchlist.split(",").map((s) => s.trim()).filter(Boolean),
      webhooks,
      enabled: true,
    };

    try {
      const resp = await fetch(`${API_BASE}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job),
      });
      const data = await resp.json();
      if (data.success) {
        setMessage("任务创建成功");
        setName("");
        setEditing(false);
        fetchJobs();
      } else {
        setError(data.error || "创建失败");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/jobs/${id}`, { method: "DELETE" });
      fetchJobs();
    } catch { /* ignore */ }
  };

  const handleTrigger = async (id: string) => {
    setMessage("");
    try {
      const resp = await fetch(`${API_BASE}/jobs/${id}/run`, { method: "POST" });
      const data = await resp.json();
      if (data.success) setMessage("手动执行已触发");
      else setError(data.error || "触发失败");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;
    try {
      const resp = await fetch(`${API_BASE}/test-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl, type: webhookType }),
      });
      const data = await resp.json();
      if (data.success) setMessage("测试消息已发送");
      else setError(data.error || "发送失败");
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="flex h-[calc(100vh-48px)]">
      {/* Sidebar - Job list */}
      <div className="w-72 shrink-0 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-200">监控任务</h2>
          <button onClick={() => setEditing(true)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded">
            新建
          </button>
        </div>

        {jobs.length === 0 && (
          <div className="text-gray-500 text-sm">暂无任务</div>
        )}

        <div className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id}
              className="bg-gray-800 rounded p-3 border border-gray-700 hover:border-gray-600">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">{job.name}</span>
                <button onClick={() => handleDelete(job.id)}
                  className="text-xs text-red-400 hover:text-red-300">删除</button>
              </div>
              <div className="text-xs text-gray-500 mt-1">{job.cron}</div>
              <button onClick={() => handleTrigger(job.id)}
                className="text-xs text-blue-400 hover:text-blue-300 mt-2">
                立即执行
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main - Create/Edit form */}
      <div className="flex-1 overflow-y-auto p-4">
        {!editing ? (
          <div className="text-gray-500 text-center mt-20">
            点击"新建"创建监控任务，定时扫描符合条件的股票并通过Webhook推送通知
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-gray-200">创建监控任务</h3>

            <div>
              <label className="text-xs text-gray-400 block mb-1">任务名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="如：每日超跌扫描"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">执行周期</label>
              <div className="grid grid-cols-3 gap-1 mb-2">
                {CRON_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => setCron(p.value)}
                    className={`py-1.5 text-xs rounded ${cron === p.value ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <input value={cron} onChange={(e) => setCron(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 font-mono" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">股票池 (逗号分隔，留空=全A股)</label>
                <input value={stockPool} onChange={(e) => setStockPool(e.target.value)}
                  placeholder="000001,600519"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">观察列表 (逗号分隔)</label>
                <input value={watchlist} onChange={(e) => setWatchlist(e.target.value)}
                  placeholder="000001,600519"
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">止损 %</label>
                <input type="number" value={stopLossPct} onChange={(e) => setStopLossPct(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">止盈 %</label>
                <input type="number" value={takeProfitPct} onChange={(e) => setTakeProfitPct(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">入场规则</label>
              <RuleBuilder ruleGroup={entryRules} onChange={setEntryRules} />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-2">Webhook配置</label>
              <div className="flex gap-2 mb-2">
                <select value={webhookType} onChange={(e) => setWebhookType(e.target.value as any)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200">
                  <option value="wecom">企业微信</option>
                  <option value="dingtalk">钉钉</option>
                  <option value="generic">通用</option>
                </select>
                <button onClick={handleTestWebhook}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded">
                  测试
                </button>
              </div>
              <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="Webhook URL"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200" />
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={loading || !name}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded font-medium text-sm">
                {loading ? "创建中..." : "创建任务"}
              </button>
              <button onClick={() => setEditing(false)}
                className="py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm">
                取消
              </button>
            </div>

            {error && <div className="text-red-400 text-sm bg-red-900/30 rounded p-2">{error}</div>}
            {message && <div className="text-green-400 text-sm bg-green-900/30 rounded p-2">{message}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
