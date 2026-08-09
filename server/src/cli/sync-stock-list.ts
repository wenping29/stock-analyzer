// Usage: npx tsx src/cli/sync-stock-list.ts
// Downloads all Chinese A-share codes (SH/SZ/BSE) from EastMoney and saves them to the stock_list table.

import { fetcher } from "../services/fetcher";
import { db } from "../services/database";

async function main() {
  await db.init();
  console.log("Fetching all stock codes from EastMoney...");
  const stocks = await fetcher.fetchStockList();
  db.saveStockList(stocks);
  const count = db.countStockList();
  console.log(`Done. Saved ${stocks.length} stocks to stock_list (total in DB: ${count}).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
