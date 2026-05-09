// Usage: npx tsx src/cli/fetch-kline.ts --codes=000001,600519 --start=2023-01-01 --end=2024-12-31 [--period=daily]
//   or: npx tsx src/cli/fetch-kline.ts --import-cached  (import existing JSON cache into SQLite)

import { fetchAndStore, importCachedKlines } from "../services/seed";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--import-cached")) {
    console.log("Importing cached K-line JSON files into SQLite...");
    const count = await importCachedKlines();
    console.log(`Done. ${count} files imported.`);
    process.exit(0);
  }

  const getArg = (flag: string): string | undefined => {
    const arg = args.find((a) => a.startsWith(flag + "="));
    return arg?.split("=")[1];
  };

  const codesArg = getArg("--codes");
  const start = getArg("--start") || "2023-01-01";
  const end = getArg("--end") || new Date().toISOString().slice(0, 10);
  const period = getArg("--period") || "daily";

  if (!codesArg) {
    console.error("Usage: npx tsx src/cli/fetch-kline.ts --codes=000001,600519 --start=... --end=... [--period=daily]");
    console.error("   or: npx tsx src/cli/fetch-kline.ts --import-cached");
    process.exit(1);
  }

  const codes = codesArg.split(",").map((c) => c.trim()).filter(Boolean);
  console.log(`Fetching ${period} kline for ${codes.length} stocks (${start} ~ ${end})...`);
  const result = await fetchAndStore(codes, start, end, period);
  console.log(`Done. Success: ${result.success}, Failed: ${result.failed.join(", ") || "none"}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
