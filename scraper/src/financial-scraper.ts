import axios from "axios";
import { rateLimit } from "./rate-limiter";
import { scraperDb } from "./database";

const eastmoneyApi = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Referer: "https://emweb.securities.eastmoney.com/",
    Accept: "application/json, text/plain, */*",
  },
});

function toSecucode(code: string): string {
  return code.startsWith("6") ? `${code}.SH` : `${code}.SZ`;
}

interface MainFinaData {
  SECUCODE: string;
  SECURITY_CODE: string;
  SECURITY_NAME_ABBR: string;
  ORG_TYPE: string;
  REPORT_DATE: string;
  REPORT_TYPE: string;
  EPSJB: number | null;
  EPSKCJB: number | null;
  BPS: number | null;
  TOTALOPERATEREVE: number | null;
  PARENTNETPROFIT: number | null;
  KCFJCXSYJLR: number | null;
  ROEJQ: number | null;
  ROEKCJQ: number | null;
  ZCFZL: number | null;
  TOTALOPERATEREVETZ: number | null;
  PARENTNETPROFITTZ: number | null;
  MGJYXJJE: number | null;
  MGWFPLR: number | null;
  MGZBGJ: number | null;
  XSMLL: number | null;
  XSJLL: number | null;
  ZZCJLL: number | null;
  JYXJLYYSR: number | null;
  TOTAL_SHARE: number | null;
  TOTAL_ASSETS_PK: number | null;
  OPERATE_PROFIT_PK: number | null;
  NETCASH_OPERATE_PK: number | null;
  NETCASH_INVEST_PK: number | null;
  NETCASH_FINANCE_PK: number | null;
  TOTAL_EQUITY_PK: number | null;
  [key: string]: any;
}

/** Scrape main financial data for a stock from EastMoney datacenter */
export async function scrapeFinanceSummary(code: string): Promise<void> {
  const secucode = toSecucode(code);
  await rateLimit(1000);

  try {
    const resp = await eastmoneyApi.get(
      "https://datacenter.eastmoney.com/securities/api/data/v1/get",
      {
        params: {
          reportName: "RPT_F10_FINANCE_MAINFINADATA",
          columns: "ALL",
          filter: `(SECUCODE="${secucode}")`,
          pageNumber: 1,
          pageSize: 20,
          sortTypes: -1,
          sortColumns: "REPORT_DATE",
        },
      }
    );

    const records: MainFinaData[] = resp.data?.result?.data;
    if (!records || records.length === 0) {
      console.warn(`  [${code}] 财务数据: 无数据`);
      return;
    }

    let count = 0;
    for (const r of records) {
      const reportDate = (r.REPORT_DATE || "").split(" ")[0];
      if (!reportDate) continue;

      // Save full financial report data
      const reportKey = `fin_main_${code}_${reportDate}`;
      const existing = scraperDb.getFinancialReport(code, reportDate, "main");
      if (existing) {
        console.log(`  ○ [${code}] ${reportDate} ${r.REPORT_TYPE} 已缓存`);
        continue;
      }

      const data: Record<string, number> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && typeof v === "number" && !isNaN(v)) {
          data[k] = v;
        }
      }

      scraperDb.upsertFinancialReport({
        code,
        reportDate,
        type: "main",
        data,
      });

      // Save finance summary (key metrics)
      scraperDb.upsertFinanceSummary({
        code,
        reportDate,
        eps: r.EPSJB ?? undefined,
        bvps: r.BPS ?? undefined,
        roe: r.ROEJQ ?? undefined,
        revenue: r.TOTALOPERATEREVE ?? undefined,
        profit: r.PARENTNETPROFIT ?? undefined,
      });

      count++;
      const name = r.SECURITY_NAME_ABBR || code;
      const eps = r.EPSJB != null ? `EPS=${r.EPSJB}` : "";
      const rev = r.TOTALOPERATEREVE != null ? `营收=${(r.TOTALOPERATEREVE / 1e8).toFixed(2)}亿` : "";
      const profit = r.PARENTNETPROFIT != null ? `净利=${(r.PARENTNETPROFIT / 1e8).toFixed(2)}亿` : "";
      console.log(`  ✓ [${name}] ${reportDate} ${r.REPORT_TYPE} ${eps} ${rev} ${profit}`.trim());
    }

    if (count === 0) {
      console.log(`  ○ [${code}] 财务数据均已缓存`);
    }
  } catch (e) {
    console.warn(`  ✗ [${code}] 财务数据: ${(e as Error).message}`);
  }
}

/** Scrape financial reports for a single stock across recent years */
export async function scrapeStockFinancials(
  code: string,
  _years?: number[]
): Promise<void> {
  const name = code;
  console.log(`\n--- ${name} 财务数据 ---`);
  await scrapeFinanceSummary(code);
}

/** Scrape stock list from EastMoney */
export async function scrapeStockList(): Promise<{ code: string; name: string; market?: string; industry?: string }[]> {
  console.log("\n--- 抓取股票列表 ---");
  const allStocks: { code: string; name: string; market?: string; industry?: string }[] = [];

  const sectors = [
    { name: "沪A", fs: "m:1+t:2,m:1+t:23" },
    { name: "深A", fs: "m:0+t:6,m:0+t:80" },
  ];

  for (const sector of sectors) {
    const pageSize = 100;
    const maxPages = 60;
    let page = 1;

    while (page <= maxPages) {
      await rateLimit(1000);
      try {
        const resp = await eastmoneyApi.get(
          "https://push2.eastmoney.com/api/qt/clist/get",
          {
            params: {
              pn: page, pz: pageSize, po: "1", np: "1",
              fltt: "2", invt: "2", fid: "f3",
              fs: sector.fs,
              fields: "f12,f14,f13,f100",
            },
          }
        );
        const items = resp.data?.data?.diff;
        const total = resp.data?.data?.total || 0;

        if (!items || !Array.isArray(items) || items.length === 0) break;

        for (const item of items) {
          allStocks.push({
            code: item.f12,
            name: item.f14,
            market: item.f13 === 1 ? "SH" : "SZ",
            industry: item.f100 || "",
          });
        }

        console.log(`  ${sector.name} 第${page}页: ${items.length} 条 (共${total}条)`);
        if (allStocks.length >= total) break;
        page++;
      } catch (e) {
        console.warn(`  ✗ ${sector.name} 第${page}页: ${(e as Error).message}`);
        page++;
      }
    }
  }

  if (allStocks.length > 0) {
    scraperDb.upsertStockList(allStocks);
    console.log(`\n共保存 ${allStocks.length} 只股票`);
  }
  return allStocks;
}

/** Get the latest annual report date for a stock (e.g. "2024-12-31") */
function getLatestAnnualDate(): string {
  const y = new Date().getFullYear();
  return `${y - 1}-12-31`;
}

/** Scrape financial data for all stocks in the local database */
export async function scrapeAllStockFinancials(): Promise<void> {
  const stocks = scraperDb.getAllStocks();
  console.log(`\n开始抓取 ${stocks.length} 只股票的财务数据...`);

  for (let i = 0; i < stocks.length; i++) {
    const stock = stocks[i];
    console.log(`\n[${i + 1}/${stocks.length}] ${stock.code} ${stock.name}`);
    await scrapeStockFinancials(stock.code);
  }
}
