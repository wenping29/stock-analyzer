// Usage: npx tsx src/cli/export-stock-list.ts
// Exports the stock_list table to a CSV file in server/data/ (UTF-8 with BOM).

import * as fs from "fs";
import * as path from "path";
import { db } from "../services/database";

const OUT_PATH = path.join(__dirname, "../../data/stock_list.csv");

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

async function main() {
  await db.init();
  const rows = db.getStockList();
  if (rows.length === 0) {
    console.error("stock_list 表为空，请先运行 npm run sync:stocklist");
    process.exit(1);
  }

  const header = ["code", "name", "market", "industry", "updated_at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.code, r.name, r.market || "", r.industry || "", r.updated_at || ""].map(csvEscape).join(","));
  }

  const content = "\uFEFF" + lines.join("\r\n");
  fs.writeFileSync(OUT_PATH, content, "utf-8");

  console.log(`Exported ${rows.length} stocks to ${OUT_PATH}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
