import { scraperDb } from "./database";
import { scrapeStockFinancials, scrapeStockList, scrapeFinanceSummary, scrapeAllStockFinancials } from "./financial-scraper";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const command = process.argv[2] || "help";
  const code = process.argv[3];

  // Ensure data dir exists
  const dataDir = path.join(__dirname, "../data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  await scraperDb.init();
  console.log("股票财务数据爬虫 v2.0");
  console.log("=" .repeat(40));

  switch (command) {
    case "financials": {
      if (!code) {
        console.error("用法: npm run scrape:financials -- <股票代码>");
        console.error("示例: npm run scrape:financials -- 600519");
        process.exit(1);
      }
      await scrapeStockFinancials(code);
      break;
    }

    case "stock-list": {
      const stocks = await scrapeStockList();
      console.log(`\n成功抓取 ${stocks.length} 只股票`);
      break;
    }

    case "finance-summary": {
      if (code) {
        await scrapeFinanceSummary(code);
      } else {
        const stocks = scraperDb.getAllStocks();
        if (stocks.length === 0) {
          console.log("股票列表为空，请先运行 stock-list 命令");
          break;
        }
        console.log(`\n抓取 ${stocks.length} 只股票的财务摘要...`);
        for (const stock of stocks) {
          await scrapeFinanceSummary(stock.code);
        }
      }
      break;
    }

    case "all": {
      // 1. Stock list
      let stocks = scraperDb.getAllStocks();
      if (stocks.length === 0) {
        stocks = await scrapeStockList();
      } else {
        console.log(`\n使用已缓存的股票列表 (${stocks.length} 只)`);
      }

      // 2. Financials
      await scrapeAllStockFinancials();
      break;
    }

    case "check": {
      // Check database stats
      const stocks = scraperDb.getAllStocks();
      console.log(`股票列表: ${stocks.length} 只`);
      for (const s of stocks.slice(0, 5)) {
        console.log(`  ${s.code} ${s.name}`);
      }
      if (stocks.length > 5) console.log(`  ... 还有 ${stocks.length - 5} 只`);
      break;
    }

    case "help":
    default:
      console.log(`
用法: npm run scrape:<command> [参数]

命令:
  scrape:financials <code>     抓取单只股票财务数据 (EPS/ROE/营收/利润等)
  scrape:stock-list            抓取全市场股票列表 (沪A+深A+创业板)
  scrape:finance-summary       全量抓取财务摘要
  scrape:all                   全量抓取 (先拉列表再拉财务数据)
  scrape:check                 查看数据库状态

数据源: 东方财富数据中心
数据存储: data/scraper.db (SQLite)
抓取间隔: 每次请求至少间隔1秒 (合规)
`);
      break;
  }

  scraperDb.close();
  console.log("\n完成!");
}

main().catch(console.error);
