import * as fs from "fs";
import * as path from "path";
import { db } from "./database";
import { fetcher } from "./fetcher";

const CACHE_DIR = path.join(__dirname, "../../data");

// Import existing cached K-line JSON files into SQLite
export async function importCachedKlines(): Promise<number> {
  await db.init();

  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.startsWith("kline_") && f.endsWith(".json"));
  let imported = 0;

  for (const file of files) {
    const fp = path.join(CACHE_DIR, file);
    try {
      const raw = fs.readFileSync(fp, "utf-8");
      const entry = JSON.parse(raw);
      const data = entry.data;
      if (!data || !Array.isArray(data) || data.length === 0) continue;

      // Parse code, period, date range from filename
      // Format: kline_{code}_{period}_{start}_{end}_{adjust}.json
      const nameWithoutExt = file.replace(".json", "");
      const parts = nameWithoutExt.split("_");
      // parts: ["kline", code, period, start, end, adjust]
      if (parts.length < 6) continue;

      const code = parts[1];
      const period = parts[2];

      const rows = data.map((d: any) => ({
        code,
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
      imported++;
    } catch (e) {
      console.error(`[seed] Failed to import ${file}:`, (e as Error).message);
    }
  }

  console.log(`[seed] Imported ${imported} cached kline files into SQLite`);
  return imported;
}

// Bulk fetch and store K-line data for a list of stocks
export async function fetchAndStore(
  codes: string[],
  startDate: string,
  endDate: string,
  period: string = "daily"
): Promise<{ success: number; failed: string[] }> {
  await db.init();

  let success = 0;
  const failed: string[] = [];

  for (const code of codes) {
    try {
      // Skip if already have full range
      const range = db.getAvailableDateRange(code, period);
      if (range && range.minDate <= startDate && range.maxDate >= endDate) {
        console.log(`[seed] ${code}: already cached in DB, skipping`);
        success++;
        continue;
      }

      const data = await fetcher.fetchKline(code, startDate, endDate, period as any, "qfq");
      if (!data || data.length === 0) {
        console.warn(`[seed] ${code}: API returned empty data`);
        failed.push(code);
        continue;
      }

      const rows = data.map((d) => ({
        code,
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
      console.log(`[seed] ${code}: stored ${rows.length} ${period} klines (${startDate} ~ ${endDate})`);
      success++;

      // Rate limiting: 100ms between stocks
      await new Promise((r) => setTimeout(r, 100));
    } catch (e) {
      console.error(`[seed] ${code}: fetch failed —`, (e as Error).message);
      failed.push(code);
    }
  }

  console.log(`[seed] Done: ${success} success, ${failed.length} failed`);
  return { success, failed };
}
