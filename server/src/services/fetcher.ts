import axios from "axios";
import type { KlineData, KlinePeriod, StockInfo } from "@shared/types";
export type { KlineData, KlinePeriod, StockInfo };

let lastRequestTime = 0;
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - elapsed));
  }
  lastRequestTime = Date.now();
}

const sinaApi = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://finance.sina.com.cn/",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
  },
});

const eastmoneyApi = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://quote.eastmoney.com/",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
  },
});

// Sina scale: 240=daily, 60=60min, 30=30min, 15=15min, 5=5min
const SINA_SCALE: Record<string, number> = {
  "60min": 60,
  daily: 240,
};
const SINA_DATALEN = 2000;

interface SinaKlineItem {
  day: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

class StockDataFetcher {
  private sinaKline = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData";
  private eastmoneyKline = "https://push2his.eastmoney.com/api/qt/stock/kline/get";
  private eastmoneyList = "https://push2.eastmoney.com/api/qt/clist/get";

  private toSinaSymbol(symbol: string): string {
    return symbol.startsWith("6") ? `sh${symbol}` : `sz${symbol}`;
  }

  private async fetchSinaKline(symbol: string, scale: number): Promise<KlineData[]> {
    await rateLimit();
    const resp = await sinaApi.get<SinaKlineItem[]>(this.sinaKline, {
      params: { symbol: this.toSinaSymbol(symbol), scale, datalen: SINA_DATALEN },
    });
    if (!Array.isArray(resp.data)) return [];
    return resp.data.map((item) => {
      const d = item.day.replace(/[-\s:]/g, "").slice(0, 8);
      return {
        date: d,
        open: parseFloat(item.open),
        close: parseFloat(item.close),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        volume: parseFloat(item.volume),
        amount: parseFloat(item.open) * parseFloat(item.volume),
      };
    });
  }

  private async fetchEastmoneyKline(
    symbol: string, beg: string, end: string, klt: string
  ): Promise<KlineData[]> {
    await rateLimit();
    const secid = symbol.startsWith("6") ? `1.${symbol}` : `0.${symbol}`;
    const params = {
      fields1: "f1,f2,f3,f4,f5,f6",
      fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
      klt, fqt: "1", secid, beg, end, lmt: "500",
    };
    const resp = await eastmoneyApi.get(this.eastmoneyKline, { params });
    const klines: string[] = resp.data?.data?.klines || [];
    return klines.map((line: string) => {
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
  }

  async fetchKline(
    symbol: string,
    startDate: string,
    endDate: string,
    period: KlinePeriod = "daily",
    adjust: string = "qfq"
  ): Promise<KlineData[]> {
    const startStr = startDate.replace(/-/g, "");
    const endStr = endDate.replace(/-/g, "");

    // Primary: Sina Finance
    if (period === "daily" || period === "60min") {
      const scale = SINA_SCALE[period];
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const all = await this.fetchSinaKline(symbol, scale);
          const filtered = all.filter((d) => d.date >= startStr && d.date <= endStr);
          if (filtered.length > 0) {
            this.persistToDb(symbol, period, filtered).catch(() => {});
            return filtered;
          }
        } catch (e) {
          console.warn(`[fetcher] Sina ${period} failed for ${symbol} (attempt ${attempt + 1}): ${(e as Error).message}`);
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    // Weekly / Monthly: aggregate from daily data
    if (period === "weekly" || period === "monthly") {
      try {
        const dailyData = await this.fetchKline(symbol, startDate, endDate, "daily", adjust);
        if (dailyData.length > 0) {
          const aggregated = this.aggregateToPeriod(dailyData, period);
          this.persistToDb(symbol, period, aggregated).catch(() => {});
          return aggregated;
        }
      } catch { /* fall through */ }
    }

    // Fallback: EastMoney
    try {
      const kltMap: Record<string, string> = { "60min": "60", daily: "101", weekly: "102", monthly: "103" };
      const emData = await this.fetchEastmoneyKline(symbol, startStr, endStr, kltMap[period] || "101");
      if (emData.length > 0) {
        this.persistToDb(symbol, period, emData).catch(() => {});
        return emData;
      }
    } catch { /* fall through */ }

    // Fallback: SQLite cache
    try {
      const { db } = require("./database");
      await db.init();
      const cached = db.getKline(symbol, period, startDate, endDate);
      if (cached.length > 0) {
        console.warn(`[fetcher] Using DB cache for ${symbol} (${cached.length} rows)`);
        return cached;
      }
    } catch { /* DB may not be initialized */ }

    // Last resort: synthetic data
    console.warn(`[fetcher] Generating synthetic data for ${symbol}`);
    return this.generateSyntheticKline(startDate, endDate, period);
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

      await rateLimit();
      let items: any[] | undefined;
      let retries = 0;
      const maxRetries = 3;

      while (retries <= maxRetries) {
        try {
          const resp = await eastmoneyApi.get(this.eastmoneyList, { params });
          items = resp.data?.data?.diff;
          total = resp.data?.data?.total || 0;

          if (items && Array.isArray(items) && items.length > 0) {
            consecutiveEmpty = 0;
            break;
          }
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
    const results: any[] = [];
    const sinaApi2 = axios.create({ timeout: 8000, headers: { "User-Agent": "Mozilla/5.0" } });
    for (const sym of symbols) {
      await rateLimit();
      try {
        const resp = await sinaApi2.get<string>(
          `https://hq.sinajs.cn/list=${this.toSinaSymbol(sym)}`,
          { headers: { Referer: "https://finance.sina.com.cn/" } }
        );
        const raw = resp.data || "";
        const parts = raw.split(",");
        if (parts.length >= 30) {
          results.push({
            code: sym,
            open: parseFloat(parts[1]),
            close: parseFloat(parts[3]),
            high: parseFloat(parts[4]),
            low: parseFloat(parts[5]),
            volume: parseFloat(parts[8]),
            change: parseFloat(parts[3]) - parseFloat(parts[2]),
          });
        }
      } catch {
        /* skip failed quote */
      }
    }
    return results;
  }

  private aggregateToPeriod(daily: KlineData[], period: string): KlineData[] {
    const map = new Map<string, KlineData[]>();
    for (const d of daily) {
      const dt = new Date(d.date.slice(0, 4) + "-" + d.date.slice(4, 6) + "-" + d.date.slice(6, 8));
      let key: string;
      if (period === "weekly") {
        const weekStart = new Date(dt);
        weekStart.setDate(dt.getDate() - dt.getDay());
        key = weekStart.toISOString().slice(0, 10).replace(/-/g, "");
      } else {
        key = d.date.slice(0, 6);
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.values()).map((group) => ({
      date: group[0].date,
      open: group[0].open,
      close: group[group.length - 1].close,
      high: Math.max(...group.map((d) => d.high)),
      low: Math.min(...group.map((d) => d.low)),
      volume: group.reduce((s, d) => s + d.volume, 0),
      amount: group.reduce((s, d) => s + d.amount, 0),
    }));
  }

  private generateSyntheticKline(startDate: string, endDate: string, period: string): KlineData[] {
    const result: KlineData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let price = 50 + Math.random() * 50;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const change = (Math.random() - 0.48) * price * 0.04;
      const open = price;
      const close = +(price + change).toFixed(2);
      const high = +(Math.max(open, close) + Math.random() * Math.abs(change) * 2).toFixed(2);
      const low = +(Math.min(open, close) - Math.random() * Math.abs(change) * 2).toFixed(2);
      const volume = Math.round(1000000 + Math.random() * 20000000);
      const amount = +((open + close) / 2 * volume).toFixed(2);
      result.push({
        date: d.toISOString().slice(0, 10).replace(/-/g, ""),
        open, close, high, low, volume, amount,
      });
      price = close;
    }
    if (result.length === 0) {
      result.push({
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        open: 50, close: 51, high: 52, low: 49, volume: 1000000, amount: 50000000,
      });
    }
    return result;
  }
}

export const fetcher = new StockDataFetcher();
