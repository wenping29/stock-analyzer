import { db } from "../services/database";
import { fetcher } from "../services/fetcher";

const PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

async function main() {
  await db.init();

  const startDate = process.argv[2] ?? "2015-01-01";
  const endDate = process.argv[3] ?? new Date().toISOString().slice(0, 10);

  console.log(`=== 同步原油期货价格 (${startDate} ~ ${endDate}) ===\n`);

  try {
    const allData = await fetcher.fetchCrudeOilAllPeriods(startDate, endDate);

    for (const period of PERIODS) {
      const data = allData[period];
      if (data.length === 0) {
        console.log(`${period}: 无数据`);
        continue;
      }
      db.insertCrudeOil(period, data);
      console.log(`${period}: ${data.length} 条 (${data[0].date} ~ ${data[data.length - 1].date})`);
    }
  } catch (e) {
    console.error("错误:", (e as Error).message);
  }

  db.close();
  console.log("\n=== 同步完成 ===");
}

main().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});