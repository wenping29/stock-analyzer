import { db } from "../services/database";
import { fetcher } from "../services/fetcher";
import { MARKET_INDEXES } from "../services/marketIndex";

const INDEX_CODES = [
  { code: "sh000001", name: "上证指数" },
  { code: "sh000300", name: "沪深300" },
  { code: "sz399006", name: "创业板指" },
  { code: "sh000688", name: "科创50" },
  { code: "bj899050", name: "北证50" },
];

const PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

async function main() {
  await db.init();

  const startDate = process.argv[2] ?? "2005-01-01";
  const endDate = process.argv[3] ?? new Date().toISOString().slice(0, 10);

  console.log(`=== 同步大盘指数数据 (${startDate} ~ ${endDate}) ===\n`);

  for (const idx of INDEX_CODES) {
    console.log(`--- ${idx.name} (${idx.code}) ---`);
    try {
      const allData = await fetcher.fetchIndexAllPeriods(idx.code, startDate, endDate);

      for (const period of PERIODS) {
        const data = allData[period];
        if (data.length === 0) {
          console.log(`  ${period}: 无数据`);
          continue;
        }
        const rows = data.map((d) => ({
          code: idx.code,
          date: d.date,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume,
          amount: d.amount,
        }));
        db.insertIndexPeriod(period, rows);
        console.log(`  ${period}: ${rows.length} 条 (${rows[0].date} ~ ${rows[rows.length - 1].date})`);
      }
    } catch (e) {
      console.error(`  错误: ${(e as Error).message}`);
    }
    console.log("");
  }

  db.close();
  console.log("=== 同步完成 ===");
}

main().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});