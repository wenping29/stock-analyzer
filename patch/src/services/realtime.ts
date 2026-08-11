import type { RealtimeQuote } from "@shared/types";
import { fetcher } from "./fetcher";

const REFRESH_INTERVAL_MS = Number(process.env.REALTIME_REFRESH_MS) || 60000;

class RealtimeQuoteService {
  private quotes = new Map<string, RealtimeQuote>();
  private lastUpdated: number | null = null;
  private lastDurationMs: number | null = null;
  private refreshing = false;
  private timer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    try {
      await this.refresh();
    } catch (e) {
      console.error(`[realtime] initial refresh failed: ${(e as Error).message}`);
    }
    this.scheduleNext();
  }

  private scheduleNext(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.refresh()
        .then(() => this.scheduleNext())
        .catch((e) => {
          console.error(`[realtime] refresh failed: ${(e as Error).message}`);
          this.scheduleNext();
        });
    }, REFRESH_INTERVAL_MS);
  }

  async refresh(): Promise<number> {
    if (this.refreshing) return this.quotes.size;
    this.refreshing = true;
    const start = Date.now();
    try {
      const list = await fetcher.fetchRealtimeQuotes();
      const map = new Map<string, RealtimeQuote>();
      for (const q of list) map.set(q.code, q);
      this.quotes = map;
      this.lastUpdated = Date.now();
      this.lastDurationMs = Date.now() - start;
      console.log(`[realtime] refreshed ${list.length} quotes in ${this.lastDurationMs}ms`);
      return list.length;
    } finally {
      this.refreshing = false;
    }
  }

  getAll(): RealtimeQuote[] {
    return Array.from(this.quotes.values());
  }

  get(code: string): RealtimeQuote | null {
    return this.quotes.get(code) || null;
  }

  getStatus(): { count: number; lastUpdated: number | null; lastDurationMs: number | null; refreshing: boolean } {
    return {
      count: this.quotes.size,
      lastUpdated: this.lastUpdated,
      lastDurationMs: this.lastDurationMs,
      refreshing: this.refreshing,
    };
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}

export const realtimeQuotes = new RealtimeQuoteService();
