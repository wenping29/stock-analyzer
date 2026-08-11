import axios from "axios";
import type { AxiosInstance, AxiosError } from "axios";
import type { KlineData, KlinePeriod, StockInfo, RealtimeQuote, MacroIndicator } from "@shared/types";
export type { KlineData, KlinePeriod, StockInfo, RealtimeQuote, MacroIndicator };

// ---------- configuration ----------
const RATE_LIMIT_MS = 2000;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

// ---------- rate limiter ----------
let lastRequestTime = 0;
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ---------- retryable axios factory ----------
const RETRYABLE_ERROR_CODES = new Set(["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK", "ERR_HTTP_REQUEST"]);
function isRetryable(err: AxiosError): boolean {
  if (err.code && RETRYABLE_ERROR_CODES.has(err.code)) return true;
  const msg = (err.message ?? "").toLowerCase();
  if (msg.includes("socket hang up") || msg.includes("timeout") || msg.includes("network")) return true;
  return false;
}

function createRetryableClient(baseConfig: Record<string, any>): AxiosInstance {
  const client = axios.create({ timeout: REQUEST_TIMEOUT_MS, ...baseConfig });

  client.interceptors.response.use(undefined, async (err: AxiosError) => {
    const config = err.config as any;
    if (!config || !isRetryable(err)) return Promise.reject(err);

    config.__retryCount = config.__retryCount ?? 0;
    if (config.__retryCount >= MAX_RETRIES) return Promise.reject(err);

    config.__retryCount++;
    const delay = Math.min(1000 * Math.pow(2, config.__retryCount), 10000);
    console.warn(`[fetcher] ${err.code || err.message} — retry ${config.__retryCount}/${MAX_RETRIES} after ${delay}ms`);
    await new Promise((r) => setTimeout(r, delay));
    return client(config);
  });

  return client;
}

const sinaApi = createRetryableClient({
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://finance.sina.com.cn/",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
  },
});

const eastmoneyApi = createRetryableClient({
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
  private eastmoneyListBaseUrls = [
    "https://push2.eastmoney.com",
    "https://push2delay.eastmoney.com",
  ];

  private toSinaSymbol(symbol: string): string {
    if (/^(sh|sz|bj)/i.test(symbol)) return symbol.toLowerCase();
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

  // EastMoney fs filter codes per category (verified against live API)
  private stockListFs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048";

  private static STOCK_LIST_FS: Record<string, string> = {
    all: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2104,m:0+t:7,m:1+t:3",
    a: "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048",
    b: "m:0+t:7,m:1+t:3",
    sh: "m:1+t:2,m:1+t:23",
    sz: "m:0+t:6,m:0+t:80",
    bj: "m:0+t:81+s:2048",
    chinext: "m:0+t:80",
    star: "m:1+t:23",
    neeq: "m:0+t:81+s:2104",
  };

  private async fetchClistItems(
    pageParams: Record<string, string>,
    maxPages: number
  ): Promise<{ items: any[]; total: number }> {
    const allItems: any[] = [];
    let total = 0;
    let consecutiveEmpty = 0;
    let primaryDown = false;

    for (let page = 1; page <= maxPages; page++) {
      const params = { ...pageParams, pn: String(page) };

      await rateLimit();
      let items: any[] | undefined;

      for (const baseUrl of this.eastmoneyListBaseUrls) {
        if (baseUrl === "https://push2.eastmoney.com" && primaryDown) continue;
        try {
          const resp = await eastmoneyApi.get(`${baseUrl}/api/qt/clist/get`, { params });
          items = resp.data?.data?.diff;
          total = resp.data?.data?.total || 0;
          if (Array.isArray(items) && items.length > 0) break;
        } catch (e) {
          console.warn(`fetchClistItems: ${baseUrl} page ${page} failed — ${(e as Error).message}, trying next host`);
          if (baseUrl === "https://push2.eastmoney.com") primaryDown = true;
          items = undefined;
        }
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 3) {
          console.error(`fetchClistItems: ${consecutiveEmpty} consecutive empty pages, stopping`);
          break;
        }
        continue;
      }

      allItems.push(...items);

      if (total > 0 && allItems.length >= total) break;
    }

    console.log(`fetchClistItems: got ${allItems.length}/${total} items`);
    return { items: allItems, total };
  }

  async fetchStockList(category: string = "all"): Promise<StockInfo[]> {
    const fs = StockDataFetcher.STOCK_LIST_FS[category] ?? StockDataFetcher.STOCK_LIST_FS.all;
    const { items } = await this.fetchClistItems({
      pz: "1000",
      po: "1",
      np: "1",
      fltt: "2",
      invt: "2",
      fid: "f3",
      fs,
      fields: "f12,f14,f13,f100",
      ut: "bd1d9ddb04089700cf9c27f6f7426281",
    }, 80);

    if (items.length === 0) {
      throw new Error("股票列表为空，API可能限流");
    }

    // NEEQ shares code ranges with BSE (920/8 prefix) in the s:2104 filter, so strip BSE codes
    let list = items;
    if (category === "neeq") {
      list = list.filter((item) => !/^(920|8)/.test(String(item.f12)));
    }

    const seen = new Set<string>();
    const unique = list.filter((item) => {
      if (seen.has(item.f12)) return false;
      seen.add(item.f12);
      return true;
    });

    return unique.map((item: any) => ({
      code: item.f12,
      name: item.f14,
      market: this.marketOf(item.f12),
      board: this.boardOf(item.f12),
      industry: item.f100 || "",
    }));
  }

  async fetchRealtimeQuotes(): Promise<RealtimeQuote[]> {
    const { items } = await this.fetchClistItems({
      pz: "5000",
      po: "1",
      np: "1",
      fltt: "2",
      invt: "2",
      fid: "f2",
      fs: this.stockListFs,
      fields: "f12,f14,f2,f3,f5,f6,f15,f16",
      ut: "bd1d9ddb04089700cf9c27f6f7426281",
    }, 80);

    return items.map((item: any) => ({
      code: item.f12,
      name: item.f14,
      market: this.marketOf(item.f12),
      price: this.toNumber(item.f2),
      changePct: this.toNumber(item.f3),
      volume: this.toNumber(item.f5),
      amount: this.toNumber(item.f6),
      high: this.toNumber(item.f15),
      low: this.toNumber(item.f16),
    }));
  }

  // ---- Market indices (大盘指数) ----

  // symbol like "sh000001" / "sz399001"; Sina hq API returns one line per symbol
  async fetchIndexQuote(symbols: string[]): Promise<RealtimeQuote[]> {
    const results: RealtimeQuote[] = [];
    const sinaQuoteApi = createRetryableClient({
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    for (let i = 0; i < symbols.length; i += 20) {
      const chunk = symbols.slice(i, i + 20);
      await rateLimit();
      try {
        const resp = await sinaQuoteApi.get<ArrayBuffer>(
          `https://hq.sinajs.cn/list=${chunk.join(",")}`,
          {
            headers: { Referer: "https://finance.sina.com.cn/" },
            responseType: "arraybuffer",
          }
        );
        // Sina hq API returns GBK-encoded text, decode manually to avoid garbled names
        let text: string;
        try {
          text = new TextDecoder("gbk").decode(new Uint8Array(resp.data));
        } catch {
          text = new TextDecoder("utf-8").decode(new Uint8Array(resp.data));
        }
        const lines = text.split(";").filter(Boolean);
        for (const line of lines) {
          const m = line.match(/hq_str_(\w+)="(.*)"/);
          if (!m) continue;
          const sym = m[1];
          const parts = m[2].split(",");
          if (parts.length < 10) continue;
          const prevClose = parseFloat(parts[2]);
          const price = parseFloat(parts[3]);
          if (isNaN(price)) continue;
          results.push({
            code: sym,
            name: parts[0] || sym,
            market: sym.startsWith("sh") ? "SH" : "SZ",
            price,
            changePct: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
            high: parseFloat(parts[4]),
            low: parseFloat(parts[5]),
            volume: parseFloat(parts[8]),
            amount: parseFloat(parts[9]),
          });
        }
      } catch {
        /* skip failed batch */
      }
    }
    return results;
  }

  // 指数主力资金净流入（东财 fflow 日线接口），返回 code -> 主力净流入(元, 正=流入 负=流出)
  async fetchIndexCapitalFlow(symbols: string[]): Promise<Map<string, number>> {
    const flows = new Map<string, number>();
    for (const sym of symbols) {
      const secid = sym.startsWith("sh") ? `1.${sym.slice(2)}` : `0.${sym.slice(2)}`;
      try {
        await rateLimit();
        const resp = await eastmoneyApi.get(
          "https://push2his.eastmoney.com/api/qt/stock/fflow/daykline/get",
          {
            params: {
              lmt: "1",
              klt: "101",
              secid,
              fields1: "f1,f2,f3,f7",
              fields2: "f51,f52,f53,f54,f55,f56",
            },
          }
        );
        const klines: string[] = resp.data?.data?.klines || [];
        if (klines.length > 0) {
          const main = parseFloat(klines[0].split(",")[1]);
          if (!isNaN(main)) flows.set(sym, main);
        }
      } catch (err) {
        console.warn(`[fetcher] capital flow failed for ${sym}: ${(err as Error).message}`);
      }
    }
    return flows;
  }

  // 美债利率历史（新浪财经债券：US3MT / US6MT / US1YT / US10YT），返回每日收盘利率(%), 最多约1000个交易日
  async fetchUsShortRateHistory(maturity: string = "3M"): Promise<{ date: string; rate: number }[]> {
    const symbolByMaturity: Record<string, string> = {
      "3M": "US3MT",
      "6M": "US6MT",
      "1Y": "US1YT",
      "10Y": "US10YT",
    };
    const symbol = symbolByMaturity[maturity] || "US3MT";

    await rateLimit();
    const resp = await sinaApi.get("https://bond.finance.sina.com.cn/hq/gb/daily", {
      params: { symbol },
    });

    const rows: { d: string; c: string }[] = resp.data?.result?.data || [];
    return rows
      .map((r) => {
        const rate = parseFloat(r.c);
        return { date: String(r.d).slice(0, 10), rate: isNaN(rate) ? NaN : rate };
      })
      .filter((r) => !isNaN(r.rate));
  }

  // 人民币利率历史 — 支持 SHIBOR_3M(东方财富) / CN_10Y(新浪债券)
  async fetchCnRateHistory(type: string = "SHIBOR_3M"): Promise<{ date: string; rate: number }[]> {
    if (type === "CN_10Y") {
      return this.fetchCnBondHistory("CN10YT");
    }
    return this.fetchShiborHistory(type);
  }

  private async fetchCnBondHistory(symbol: string): Promise<{ date: string; rate: number }[]> {
    await rateLimit();
    const resp = await sinaApi.get("https://bond.finance.sina.com.cn/hq/gb/daily", {
      params: { symbol },
    });

    const rows: { d: string; c: string }[] = resp.data?.result?.data || [];
    return rows
      .map((r) => {
        const rate = parseFloat(r.c);
        return { date: String(r.d).slice(0, 10), rate: isNaN(rate) ? NaN : rate };
      })
      .filter((r) => !isNaN(r.rate));
  }

  private async fetchShiborHistory(type: string): Promise<{ date: string; rate: number }[]> {
    const indicatorIdByType: Record<string, string> = {
      "SHIBOR_ON": "001",
      "SHIBOR_1W": "101",
      "SHIBOR_2W": "102",
      "SHIBOR_1M": "201",
      "SHIBOR_3M": "203",
      "SHIBOR_6M": "206",
      "SHIBOR_9M": "209",
      "SHIBOR_1Y": "301",
    };
    const indicatorId = indicatorIdByType[type] || "203";

    const allRows: { date: string; rate: number }[] = [];
    const pageSize = 500;
    let page = 1;
    let total = 0;
    let batch: any[] = [];

    do {
      await rateLimit();
      const resp = await eastmoneyApi.get("https://datacenter-web.eastmoney.com/api/data/v1/get", {
        params: {
          reportName: "RPT_IMP_INTRESTRATEN",
          columns: "ALL",
          pageSize: String(pageSize),
          pageNumber: String(page),
          sortColumns: "REPORT_DATE",
          sortTypes: "-1",
          filter: `(MARKET_CODE="001")(CURRENCY_CODE="CNY")(INDICATOR_ID="${indicatorId}")`,
        },
      });

      total = resp.data?.result?.count || 0;
      batch = resp.data?.result?.data || [];

      for (const r of batch) {
        const rate = parseFloat(r.IR_RATE);
        if (!isNaN(rate)) {
          allRows.push({
            date: String(r.REPORT_DATE).slice(0, 10),
            rate,
          });
        }
      }

      page++;
    } while (allRows.length < total && batch.length > 0);

    return allRows.sort((a, b) => a.date.localeCompare(b.date));
  }

  async fetchIndexKline(
    symbol: string,
    startDate: string,
    endDate: string,
    period: KlinePeriod = "daily"
  ): Promise<KlineData[]> {
    const startStr = startDate.replace(/-/g, "");
    const endStr = endDate.replace(/-/g, "");

    if (period === "daily" || period === "60min") {
      const scale = SINA_SCALE[period] ?? 240;
      try {
        const all = await this.fetchSinaKline(symbol, scale);
        const filtered = all.filter((d) => d.date >= startStr && d.date <= endStr);
        if (filtered.length > 0) return filtered;
      } catch (e) {
        console.warn(`[fetcher] Sina index ${period} failed for ${symbol}: ${(e as Error).message}`);
      }
    }

    if (period === "weekly" || period === "monthly" || period === "quarterly" || period === "yearly") {
      try {
        const dailyData = await this.fetchIndexKline(symbol, startDate, endDate, "daily");
        if (dailyData.length > 0) {
          const aggregated = this.aggregateToPeriod(dailyData, period);
          if (aggregated.length > 0) return aggregated;
        }
      } catch { /* fall through */ }
    }

    // EastMoney fallback (indices use secid like 1.000001 / 0.399001)
    try {
      const kltMap: Record<string, string> = { "60min": "60", daily: "101", weekly: "102", monthly: "103" };
      const secid = symbol.startsWith("sh") ? `1.${symbol.slice(2)}` : `0.${symbol.slice(2)}`;
      const params = {
        fields1: "f1,f2,f3,f4,f5,f6",
        fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
        klt: kltMap[period] || "101",
        fqt: "1",
        secid,
        beg: startStr,
        end: endStr,
        lmt: "500",
      };
      await rateLimit();
      const resp = await eastmoneyApi.get(this.eastmoneyKline, { params });
      const klines: string[] = resp.data?.data?.klines || [];
      const emData = klines.map((line: string) => {
        const p = line.split(",");
        return {
          date: p[0],
          open: parseFloat(p[1]),
          close: parseFloat(p[2]),
          high: parseFloat(p[3]),
          low: parseFloat(p[4]),
          volume: parseFloat(p[5]),
          amount: parseFloat(p[6]),
        };
      });
      if (emData.length > 0) return emData;
    } catch { /* fall through */ }

    return this.generateSyntheticKline(startDate, endDate, period);
  }

  // ---- Macro indicators (大盘行情叠加标签) ----

  private async fetchSinaHq(list: string): Promise<Map<string, string[]>> {
    const resp = await sinaApi.get<ArrayBuffer>(
      `https://hq.sinajs.cn/list=${list}`,
      {
        headers: { Referer: "https://finance.sina.com.cn/" },
        responseType: "arraybuffer",
      }
    );
    // Sina hq API returns GBK-encoded text, decode manually to avoid garbled names
    let text: string;
    try {
      text = new TextDecoder("gbk").decode(new Uint8Array(resp.data));
    } catch {
      text = new TextDecoder("utf-8").decode(new Uint8Array(resp.data));
    }
    const map = new Map<string, string[]>();
    for (const line of text.split(";")) {
      const m = line.match(/hq_str_(\w+)="(.*)"/);
      if (!m) continue;
      map.set(m[1], m[2].split(","));
    }
    return map;
  }

  async fetchMacroIndicators(): Promise<MacroIndicator[]> {
    const defs: {
      key: string; name: string; unit: string; precision: number;
      sina: string; kind: "bond" | "futures" | "fx";
    }[] = [
      { key: "us10y", name: "美债10Y", unit: "%", precision: 2, sina: "globalbd_us10yt", kind: "bond" },
      { key: "us3m", name: "美债3M", unit: "%", precision: 2, sina: "globalbd_us3mt", kind: "bond" },
      { key: "usdcny", name: "美元兑人民币", unit: "", precision: 4, sina: "fx_susdcny", kind: "fx" },
      { key: "oil", name: "WTI原油", unit: "$", precision: 2, sina: "hf_CL", kind: "futures" },
      { key: "cn10y", name: "中债10Y", unit: "%", precision: 2, sina: "globalbd_cn10yt", kind: "bond" },
    ];

    await rateLimit();
    const raw = await this.fetchSinaHq(defs.map((d) => d.sina).join(","));

    const results: MacroIndicator[] = [];
    for (const def of defs) {
      const parts = raw.get(def.sina);
      if (!parts || parts.length < 10) continue;
      let value = NaN;
      let changePct = 0;
      let time = "";
      if (def.kind === "bond") {
        value = parseFloat(parts[1]);
        changePct = parseFloat(parts[7]);
        time = parts[12] || "";
      } else if (def.kind === "futures") {
        value = parseFloat(parts[0]);
        const prev = parseFloat(parts[7]);
        changePct = prev > 0 ? ((value - prev) / prev) * 100 : 0;
        time = parts[12] || "";
      } else if (def.kind === "fx") {
        value = parseFloat(parts[1]);
        changePct = parseFloat(parts[10]);
        time = parts[17] || "";
      }
      if (isNaN(value)) continue;
      results.push({
        key: def.key,
        name: def.name,
        value,
        changePct: isNaN(changePct) ? 0 : changePct,
        unit: def.unit,
        precision: def.precision,
        time,
      });
    }

    // 人民币利率 — SHIBOR 3M（东方财富数据中心）
    try {
      await rateLimit();
      const resp = await eastmoneyApi.get("https://datacenter-web.eastmoney.com/api/data/v1/get", {
        params: {
          reportName: "RPT_IMP_INTRESTRATEN",
          columns: "ALL",
          pageSize: "1",
          sortColumns: "REPORT_DATE",
          sortTypes: "-1",
          filter: '(MARKET_CODE="001")(CURRENCY_CODE="CNY")(INDICATOR_ID="203")(LATEST_RECORD="1")',
        },
      });
      const row = resp.data?.result?.data?.[0];
      const rate = parseFloat(row?.IR_RATE);
      if (row && !isNaN(rate)) {
        const change = parseFloat(row?.CHANGE_RATE);
        results.push({
          key: "cnrate",
          name: "SHIBOR 3M",
          value: rate,
          changePct: isNaN(change) ? 0 : change / 100,
          unit: "%",
          precision: 2,
          time: row.REPORT_DATE ? String(row.REPORT_DATE).slice(0, 10) : "",
        });
      }
    } catch (e) {
      console.warn(`[fetcher] SHIBOR fetch failed: ${(e as Error).message}`);
    }

    return results;
  }

  private toNumber(v: any): number {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  private marketOf(code: string): string {
    if (/^6/.test(code) || /^900/.test(code)) return "SH";
    if (/^[03]/.test(code) || /^200/.test(code)) return "SZ";
    if (/^920|^8/.test(code)) return "BJ";
    if (/^4/.test(code)) return "NEEQ";
    return "其他";
  }

  private boardOf(code: string): string {
    if (/^688|^689/.test(code)) return "科创板";
    if (/^300|^301/.test(code)) return "创业板";
    if (/^6/.test(code)) return "沪市A股";
    if (/^[03]/.test(code)) return "深市A股";
    if (/^920|^8/.test(code)) return "北交所";
    if (/^900/.test(code)) return "沪市B股";
    if (/^200/.test(code)) return "深市B股";
    if (/^4/.test(code)) return "新三板";
    return "其他";
  }

  async fetchRealTimeQuote(symbols: string[]): Promise<any[]> {
    const results: any[] = [];
    const sinaQuoteApi = createRetryableClient({
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    for (const sym of symbols) {
      await rateLimit();
      try {
        const resp = await sinaQuoteApi.get<string>(
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
      } else if (period === "monthly") {
        key = d.date.slice(0, 6);
      } else if (period === "quarterly") {
        const year = d.date.slice(0, 4);
        const month = parseInt(d.date.slice(4, 6), 10);
        const quarter = Math.ceil(month / 3);
        key = year + "Q" + quarter;
      } else if (period === "yearly") {
        key = d.date.slice(0, 4);
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

  async fetchIndexAllPeriods(symbol: string, startDate: string, endDate: string): Promise<Record<string, KlineData[]>> {
    const dailyData = await this.fetchIndexKline(symbol, startDate, endDate, "daily");
    if (dailyData.length === 0) {
      return { daily: [], weekly: [], monthly: [], quarterly: [], yearly: [] };
    }

    return {
      daily: dailyData,
      weekly: this.aggregateToPeriod(dailyData, "weekly"),
      monthly: this.aggregateToPeriod(dailyData, "monthly"),
      quarterly: this.aggregateToPeriod(dailyData, "quarterly"),
      yearly: this.aggregateToPeriod(dailyData, "yearly"),
    };
  }

  async fetchFxCnyUsdDaily(startDate: string, endDate: string): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
    const startStr = startDate.replace(/-/g, "");
    const endStr = endDate.replace(/-/g, "");

    const allRates: Record<string, number> = {};
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      const chunkStart = year === startYear ? startDate : `${year}-01-01`;
      const chunkEnd = year === endYear ? endDate : `${year}-12-31`;
      const url = `https://api.frankfurter.app/${chunkStart}..${chunkEnd}`;

      try {
        const resp = await axios.get(url, {
          params: { from: "USD", to: "CNY" },
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: REQUEST_TIMEOUT_MS,
        });
        const rates: Record<string, { CNY: number }> = resp.data?.rates || {};
        for (const [date, val] of Object.entries(rates)) {
          const dateStr = date.replace(/-/g, "");
          if (dateStr >= startStr && dateStr <= endStr) {
            allRates[dateStr] = val.CNY;
          }
        }
        await rateLimit();
      } catch (e) {
        console.warn(`[fetcher] Frankfurter ${year} failed: ${(e as Error).message}`);
      }
    }

    const sortedDates = Object.keys(allRates).sort();
    const result: { date: string; open: number; high: number; low: number; close: number }[] = [];

    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const rate = allRates[date];
      const prevRate = i > 0 ? allRates[sortedDates[i - 1]] : rate;
      result.push({
        date,
        open: prevRate,
        high: Math.max(prevRate, rate),
        low: Math.min(prevRate, rate),
        close: rate,
      });
    }

    return result;
  }

  async fetchFxCnyUsdAllPeriods(startDate: string, endDate: string): Promise<Record<string, { date: string; open: number; high: number; low: number; close: number }[]>> {
    const dailyData = await this.fetchFxCnyUsdDaily(startDate, endDate);
    if (dailyData.length === 0) {
      return { daily: [], weekly: [], monthly: [], quarterly: [], yearly: [] };
    }

    const toKline = (d: { date: string; open: number; high: number; low: number; close: number }[]): KlineData[] =>
      d.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: 0, amount: 0 }));

    const fromKline = (k: KlineData[]): { date: string; open: number; high: number; low: number; close: number }[] =>
      k.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));

    return {
      daily: dailyData,
      weekly: fromKline(this.aggregateToPeriod(toKline(dailyData), "weekly")),
      monthly: fromKline(this.aggregateToPeriod(toKline(dailyData), "monthly")),
      quarterly: fromKline(this.aggregateToPeriod(toKline(dailyData), "quarterly")),
      yearly: fromKline(this.aggregateToPeriod(toKline(dailyData), "yearly")),
    };
  }

  async fetchGoldPriceDaily(startDate: string, endDate: string): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
    const allRows: { date: string; open: number; high: number; low: number; close: number }[] = [];
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    const startStr = startDate.replace(/-/g, "");
    const endStr = endDate.replace(/-/g, "");

    for (let year = startYear; year <= endYear; year++) {
      const chunkStart = year === startYear ? startDate : `${year}-01-01`;
      const chunkEnd = year === endYear ? endDate : `${year}-12-31`;

      try {
        const resp = await axios.get("https://api.investing.com/api/financialdata/historical/8830", {
          params: {
            "start-date": chunkStart,
            "end-date": chunkEnd,
            "time-frame": "Daily",
            "add-missing-rows": "false",
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "domain-id": "www",
          },
          timeout: REQUEST_TIMEOUT_MS,
        });

        const data = resp.data?.data || [];
        for (const row of data) {
          const dateStr = new Date(row.rowDateRaw * 1000).toISOString().slice(0, 10).replace(/-/g, "");
          if (dateStr >= startStr && dateStr <= endStr) {
            allRows.push({
              date: dateStr,
              open: row.last_openRaw,
              high: row.last_maxRaw,
              low: row.last_minRaw,
              close: row.last_closeRaw,
            });
          }
        }
        await rateLimit();
      } catch (e) {
        console.warn(`[fetcher] Investing.com ${year} failed: ${(e as Error).message}`);
      }
    }

    return allRows.sort((a, b) => a.date.localeCompare(b.date));
  }

  async fetchGoldPriceAllPeriods(startDate: string, endDate: string): Promise<Record<string, { date: string; open: number; high: number; low: number; close: number }[]>> {
    const dailyData = await this.fetchGoldPriceDaily(startDate, endDate);
    if (dailyData.length === 0) {
      return { daily: [], weekly: [], monthly: [], quarterly: [], yearly: [] };
    }

    const toKline = (d: { date: string; open: number; high: number; low: number; close: number }[]): KlineData[] =>
      d.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: 0, amount: 0 }));

    const fromKline = (k: KlineData[]): { date: string; open: number; high: number; low: number; close: number }[] =>
      k.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));

    return {
      daily: dailyData,
      weekly: fromKline(this.aggregateToPeriod(toKline(dailyData), "weekly")),
      monthly: fromKline(this.aggregateToPeriod(toKline(dailyData), "monthly")),
      quarterly: fromKline(this.aggregateToPeriod(toKline(dailyData), "quarterly")),
      yearly: fromKline(this.aggregateToPeriod(toKline(dailyData), "yearly")),
    };
  }

  async fetchCrudeOilDaily(startDate: string, endDate: string): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
    const allRows: { date: string; open: number; high: number; low: number; close: number }[] = [];
    const startYear = new Date(startDate).getFullYear();
    const endYear = new Date(endDate).getFullYear();
    const startStr = startDate.replace(/-/g, "");
    const endStr = endDate.replace(/-/g, "");

    for (let year = startYear; year <= endYear; year++) {
      const chunkStart = year === startYear ? startDate : `${year}-01-01`;
      const chunkEnd = year === endYear ? endDate : `${year}-12-31`;

      try {
        const resp = await axios.get("https://api.investing.com/api/financialdata/historical/8833", {
          params: {
            "start-date": chunkStart,
            "end-date": chunkEnd,
            "time-frame": "Daily",
            "add-missing-rows": "false",
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "domain-id": "www",
          },
          timeout: REQUEST_TIMEOUT_MS,
        });

        const data = resp.data?.data || [];
        for (const row of data) {
          const dateStr = new Date(row.rowDateRaw * 1000).toISOString().slice(0, 10).replace(/-/g, "");
          if (dateStr >= startStr && dateStr <= endStr) {
            allRows.push({
              date: dateStr,
              open: row.last_openRaw,
              high: row.last_maxRaw,
              low: row.last_minRaw,
              close: row.last_closeRaw,
            });
          }
        }
        await rateLimit();
      } catch (e) {
        console.warn(`[fetcher] Investing.com oil ${year} failed: ${(e as Error).message}`);
      }
    }

    return allRows.sort((a, b) => a.date.localeCompare(b.date));
  }

  async fetchCrudeOilAllPeriods(startDate: string, endDate: string): Promise<Record<string, { date: string; open: number; high: number; low: number; close: number }[]>> {
    const dailyData = await this.fetchCrudeOilDaily(startDate, endDate);
    if (dailyData.length === 0) {
      return { daily: [], weekly: [], monthly: [], quarterly: [], yearly: [] };
    }

    const toKline = (d: { date: string; open: number; high: number; low: number; close: number }[]): KlineData[] =>
      d.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: 0, amount: 0 }));

    const fromKline = (k: KlineData[]): { date: string; open: number; high: number; low: number; close: number }[] =>
      k.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));

    return {
      daily: dailyData,
      weekly: fromKline(this.aggregateToPeriod(toKline(dailyData), "weekly")),
      monthly: fromKline(this.aggregateToPeriod(toKline(dailyData), "monthly")),
      quarterly: fromKline(this.aggregateToPeriod(toKline(dailyData), "quarterly")),
      yearly: fromKline(this.aggregateToPeriod(toKline(dailyData), "yearly")),
    };
  }

  async fetchCn10yDaily(): Promise<{ date: string; open: number; high: number; low: number; close: number }[]> {
    const rows = await this.fetchCnRateHistory("CN_10Y");
    return rows.map((r) => ({
      date: r.date.replace(/-/g, ""),
      open: r.rate,
      high: r.rate,
      low: r.rate,
      close: r.rate,
    }));
  }

  async fetchCn10yAllPeriods(): Promise<Record<string, { date: string; open: number; high: number; low: number; close: number }[]>> {
    const dailyData = await this.fetchCn10yDaily();
    if (dailyData.length === 0) {
      return { daily: [], weekly: [], monthly: [], quarterly: [], yearly: [] };
    }

    const toKline = (d: { date: string; open: number; high: number; low: number; close: number }[]): KlineData[] =>
      d.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: 0, amount: 0 }));

    const fromKline = (k: KlineData[]): { date: string; open: number; high: number; low: number; close: number }[] =>
      k.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));

    return {
      daily: dailyData,
      weekly: fromKline(this.aggregateToPeriod(toKline(dailyData), "weekly")),
      monthly: fromKline(this.aggregateToPeriod(toKline(dailyData), "monthly")),
      quarterly: fromKline(this.aggregateToPeriod(toKline(dailyData), "quarterly")),
      yearly: fromKline(this.aggregateToPeriod(toKline(dailyData), "yearly")),
    };
  }
}

export const fetcher = new StockDataFetcher();
