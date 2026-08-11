// Usage: npx tsx src/cli/sync-cn-rates.ts [SHIBOR_3M|CN_10Y|SHIBOR_6M|SHIBOR_1Y]
// Downloads CNY interest rate history and saves to the cn_rates table.

import { fetcher } from "../services/fetcher";
import { db } from "../services/database";

async function main() {
  await db.init();
  const type = process.argv[2] ?? "SHIBOR_3M";
  console.log(`Fetching CN ${type} rate history...`);
  const rows = await fetcher.fetchCnRateHistory(type);
  if (rows.length === 0) {
    console.error("No data fetched. Maybe the upstream API is rate-limited, retry later.");
    process.exit(1);
  }
  db.insertCnRates(type, rows);
  const range = db.getCnRatesDateRange(type);
  console.log(
    `Done. Saved ${rows.length} rows to cn_rates (${range?.minDate} ~ ${range?.maxDate}).`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});