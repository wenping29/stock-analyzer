import axios from "axios";
import type { WebhookConfig, ScreeningResult, Trade } from "@shared/types";

export interface WebhookMessage {
  title: string;
  timestamp: string;
  entrySignals?: { code: string; name: string; close: number; changePct: number }[];
  exitSignals?: { code: string; signal: string }[];
}

export class WebhookNotifier {
  async send(config: WebhookConfig, message: WebhookMessage): Promise<boolean> {
    try {
      switch (config.type) {
        case "wecom": return await this.sendWecom(config, message);
        case "dingtalk": return await this.sendDingtalk(config, message);
        case "generic": return await this.sendGeneric(config, message);
        default: return false;
      }
    } catch (e: any) {
      console.error(`[webhook] send failed (${config.type}):`, e.message);
      return false;
    }
  }

  private async sendWecom(config: WebhookConfig, msg: WebhookMessage): Promise<boolean> {
    const content = this.formatWecomMarkdown(msg);
    const body: any = { msgtype: "markdown", markdown: { content } };
    const resp = await axios.post(config.url, body, { timeout: 10000 });
    return resp.data?.errcode === 0;
  }

  private async sendDingtalk(config: WebhookConfig, msg: WebhookMessage): Promise<boolean> {
    const content = this.formatDingtalkMarkdown(msg);
    const body: any = { msgtype: "markdown", markdown: { title: msg.title, text: content } };
    const resp = await axios.post(config.url, body, { timeout: 10000 });
    return resp.data?.errcode === 0;
  }

  private async sendGeneric(config: WebhookConfig, msg: WebhookMessage): Promise<boolean> {
    const resp = await axios.post(config.url, msg, { timeout: 10000 });
    return resp.status >= 200 && resp.status < 300;
  }

  private formatWecomMarkdown(msg: WebhookMessage): string {
    let md = `## ${msg.title}\n> 时间: ${msg.timestamp}\n\n`;

    if (msg.entrySignals && msg.entrySignals.length > 0) {
      md += "### 买入信号\n| 代码 | 名称 | 收盘价 | 涨跌幅 |\n|------|------|--------|--------|\n";
      for (const s of msg.entrySignals) {
        const changeColor = s.changePct >= 0 ? "info" : "warning";
        md += `| ${s.code} | ${s.name} | ${s.close.toFixed(2)} | <font color="${changeColor}">${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%</font> |\n`;
      }
    } else {
      md += "### 买入信号\n暂无符合条件的股票\n";
    }

    if (msg.exitSignals && msg.exitSignals.length > 0) {
      md += "\n### 卖出信号\n";
      for (const s of msg.exitSignals) {
        md += `- **${s.code}**: ${s.signal}\n`;
      }
    }

    return md;
  }

  private formatDingtalkMarkdown(msg: WebhookMessage): string {
    let md = `## ${msg.title}\n\n`;
    md += `时间: ${msg.timestamp}\n\n`;

    if (msg.entrySignals && msg.entrySignals.length > 0) {
      md += "### 买入信号\n\n| 代码 | 名称 | 收盘价 | 涨跌幅 |\n|------|------|--------|--------|\n";
      for (const s of msg.entrySignals) {
        md += `| ${s.code} | ${s.name} | ${s.close.toFixed(2)} | ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% |\n`;
      }
    }

    if (msg.exitSignals && msg.exitSignals.length > 0) {
      md += "\n### 卖出信号\n\n";
      for (const s of msg.exitSignals) {
        md += `- ${s.code}: ${s.signal}\n`;
      }
    }

    return md;
  }
}

export const webhookNotifier = new WebhookNotifier();
