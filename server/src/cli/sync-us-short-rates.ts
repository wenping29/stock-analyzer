// Usage: npx tsx src/cli/sync-us-short-rates.ts [3M|6M|1Y|10Y]
// Downloads US treasury rate history from Sina Finance and saves to the us_short_rates table.

import { fetcher } from "../services/fetcher";
import { db } from "../services/database";

async function main() {
  await db.init();
  const maturity = process.argv[2] ?? "3M";
  console.log(`Fetching US ${maturity} treasury rate history...`);
  const rows = await fetcher.fetchUsShortRateHistory(maturity);
  if (rows.length === 0) {
    console.error("No data fetched. Maybe the upstream API is rate-limited, retry later.");
    process.exit(1);
  }
  db.insertUsShortRates(maturity, rows);
  const range = db.getUsShortRatesDateRange(maturity);
  console.log(
    `Done. Saved ${rows.length} rows to us_short_rates (${range?.minDate} ~ ${range?.maxDate}).`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
