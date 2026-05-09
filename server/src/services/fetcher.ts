import axios from "axios";
import type { KlineData, KlinePeriod, StockInfo } from "@shared/types";
export type { KlineData, KlinePeriod, StockInfo };

const api = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://quote.eastmoney.com/",
  },
});

const KLT_MAP: Record<KlinePeriod, string> = {
  "60min": "60",
  daily: "101",
  weekly: "102",
  monthly: "103",
};

interface EastmoneyKlineResponse {
  data: {
    code: string;
    name: string;
    klines: string[];
  };
}

class StockDataFetcher {
  private baseKline = "https://push2his.eastmoney.com/api/qt/stock/kline/get";
  private baseList = "https://push2.eastmoney.com/api/qt/clist/get";

  async fetchKline(
    symbol: string,
    startDate: string,
    endDate: string,
    period: KlinePeriod = "daily",
    adjust: string = "qfq"
  ): Promise<KlineData[]> {
    const secid = this.toSecid(symbol);
    const klt = KLT_MAP[period] || "101";
    const lmt = period === "60min" ? "800" : "500";
    const params = {
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
      klt,
      fqt: adjust === "qfq" ? "1" : adjust === "hfq" ? "2" : "0",
      secid,
      beg: startDate.replace(/-/g, ""),
      end: endDate.replace(/-/g, ""),
      lmt,
    };

    // Try API first
    try {
      const resp = await api.get<EastmoneyKlineResponse>(this.baseKline, { params });
      const klines = resp.data?.data?.klines || [];

      const result = klines.map((line: string) => {
        const parts = line.split(",");
        return {
          date: parts[0],
          open: parseFloat(parts[1]),
          close: parseFloat(parts[2]),
          high: parseFloat(parts[3]),
          low: parseFloat(parts[4]),
          volume: parseFloat(parts[5]),
          amount: parseFloat(parts[6]),
        };
      });

      // Background persist to SQLite
      if (result.length > 0) {
        this.persistToDb(symbol, period, result).catch(() => {});
      }

      return result;
    } catch (apiErr) {
      // Fall back to SQLite cache
      try {
        const { db } = require("./database");
        await db.init();
        const cached = db.getKline(symbol, period, startDate, endDate);
        if (cached.length > 0) {
          console.warn(`[fetcher] API failed for ${symbol}, using DB cache (${cached.length} rows)`);
          return cached;
        }
      } catch { /* DB may not be initialized */ }
      throw apiErr;
    }
  }

  private async persistToDb(symbol: string, period: string, data: KlineData[]): Promise<void> {
    try {
      const { db } = require("./database");
      await db.init();
      const rows = data.map((d) => ({
        code: symbol,
        period,
        date: d.date,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
        amount: d.amount,
      }));
      db.insertKlineBatch(rows);
    } catch { /* silent fail — API data is still returned */ }
  }

  async fetchStockList(): Promise<StockInfo[]> {
    const allItems: any[] = [];
    const pageSize = 100;
    const maxPages = 60;
    let total = 0;
    let consecutiveEmpty = 0;

    for (let page = 1; page <= maxPages; page++) {
      const params = {
        pn: String(page),
        pz: String(pageSize),
        po: "1",
        np: "1",
        fltt: "2",
        invt: "2",
        fid: "f3",
        fs: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
        fields: "f12,f14,f13,f100",
      };

      let items: any[] | undefined;
      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        try {
          const resp = await api.get(this.baseList, { params });
          items = resp.data?.data?.diff;
          total = resp.data?.data?.total || 0;

          if (items && Array.isArray(items) && items.length > 0) {
            consecutiveEmpty = 0;
            break;
          }
          // Empty page — may be rate limited
          retries++;
          if (retries <= maxRetries) {
            const delay = retries * 1000;
            console.warn(`fetchStockList: page ${page} empty (attempt ${retries}), retrying in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
          }
        } catch {
          retries++;
          if (retries <= maxRetries) {
            const delay = retries * 1000;
            console.warn(`fetchStockList: page ${page} error (attempt ${retries}), retrying in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
          } else {
            console.error(`fetchStockList: page ${page} failed after ${maxRetries} retries, skipping`);
            items = [];
          }
        }
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) {
          console.error(`fetchStockList: ${consecutiveEmpty} consecutive empty pages, stopping`);
          break;
        }
        continue;
      }

      allItems.push(...items);

      if (total > 0 && allItems.length >= total) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`fetchStockList: got ${allItems.length}/${total} stocks`);
    if (allItems.length === 0) {
      throw new Error("股票列表为空，API可能限流");
    }
    return allItems.map((item: any) => ({
      code: item.f12,
      name: item.f14,
      market: item.f13 === 1 ? "SH" : "SZ",
      industry: item.f100 || "",
    }));
  }

  async fetchRealTimeQuote(symbols: string[]): Promise<any[]> {
    const secids = symbols.map((s) => this.toSecid(s)).join(",");
    const params = {
      fltt: "2",
      invt: "2",
      fields: "f43,f44,f45,f46,f47,f48,f50,f57,f58,f170",
      secids,
    };
    const resp = await api.get(this.baseKline.replace("kline", "stock"), { params });
    return resp.data?.data?.diff || [];
  }

  private toSecid(symbol: string): string {
    if (symbol.startsWith("6")) return `1.${symbol}`;
    if (symbol.startsWith("0") || symbol.startsWith("3")) return `0.${symbol}`;
    if (symbol.startsWith("00")) return `0.${symbol}`;
    return `0.${symbol}`;
  }
}

export const fetcher = new StockDataFetcher();
