import { db } from "../services/database";
import { fetcher } from "../services/fetcher";

const PERIODS = ["daily", "weekly", "monthly", "quarterly", "yearly"];

async function main() {
  await db.init();

  console.log("=== 同步中债10年期国债收益率多周期数据 ===\n");

  try {
    const allData = await fetcher.fetchCn10yAllPeriods();

    for (const period of PERIODS) {
      const data = allData[period];
      if (data.length === 0) {
        console.log(`${period}: 无数据`);
        continue;
      }
      db.insertCn10y(period, data);
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