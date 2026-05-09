import * as fs from "fs";
import * as path from "path";
import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from "sql.js";

const DB_PATH = path.join(__dirname, "../data/scraper.db");

export interface FinancialReport {
  code: string;
  reportDate: string;       // e.g. "2024-12-31"
  type: "bs" | "is" | "cf"; // balance sheet / income statement / cash flow
  data: Record<string, number>;
}

export class ScraperDatabase {
  private db: SqlJsDatabase | null = null;
  private sql: SqlJsStatic | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    this.sql = await initSqlJs();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new this.sql.Database(buffer);
    } else {
      this.db = new this.sql.Database();
    }
    this.db.run("PRAGMA journal_mode = WAL");
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS financial_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        report_date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('bs','is','cf','main')),
        data TEXT NOT NULL,
        scraped_at TEXT DEFAULT (datetime('now')),
        UNIQUE(code, report_date, type)
      )
    `);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_fr_code ON financial_reports(code)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_fr_date ON financial_reports(report_date)");

    this.db.run(`
      CREATE TABLE IF NOT EXISTS stock_list (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        market TEXT,
        industry TEXT,
        scraped_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS finance_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        report_date TEXT NOT NULL,
        eps REAL,
        bvps REAL,
        pe REAL,
        pb REAL,
        roe REAL,
        revenue REAL,
        profit REAL,
        scraped_at TEXT DEFAULT (datetime('now')),
        UNIQUE(code, report_date)
      )
    `);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_fs_code ON finance_summary(code)");
  }

  upsertFinancialReport(report: FinancialReport): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO financial_reports (code, report_date, type, data)
       VALUES (?, ?, ?, ?)`,
      [report.code, report.reportDate, report.type, JSON.stringify(report.data)]
    );
    this.persist();
  }

  getFinancialReport(code: string, reportDate: string, type: string): FinancialReport | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(
      "SELECT * FROM financial_reports WHERE code = ? AND report_date = ? AND type = ?"
    );
    stmt.bind([code, reportDate, type]);
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject() as any;
    stmt.free();
    return { code: row.code, reportDate: row.report_date, type: row.type, data: JSON.parse(row.data) };
  }

  hasReport(code: string, reportDate: string, type: string): boolean {
    if (!this.db) return false;
    return this.getFinancialReport(code, reportDate, type) !== null;
  }

  upsertStockList(stocks: { code: string; name: string; market?: string; industry?: string }[]): void {
    if (!this.db || stocks.length === 0) return;
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO stock_list (code, name, market, industry) VALUES (?, ?, ?, ?)"
    );
    this.db.run("BEGIN TRANSACTION");
    for (const s of stocks) {
      stmt.run([s.code, s.name, s.market || null, s.industry || null]);
    }
    this.db.run("COMMIT");
    stmt.free();
    this.persist();
  }

  getAllStocks(): { code: string; name: string; market?: string; industry?: string }[] {
    if (!this.db) return [];
    const results: any[] = [];
    const stmt = this.db.prepare("SELECT * FROM stock_list ORDER BY code");
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  upsertFinanceSummary(summary: {
    code: string; reportDate: string; eps?: number; bvps?: number;
    pe?: number; pb?: number; roe?: number; revenue?: number; profit?: number;
  }): void {
    if (!this.db) return;
    this.db.run(
      `INSERT OR REPLACE INTO finance_summary (code, report_date, eps, bvps, pe, pb, roe, revenue, profit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [summary.code, summary.reportDate, summary.eps || null, summary.bvps || null,
       summary.pe || null, summary.pb || null, summary.roe || null,
       summary.revenue || null, summary.profit || null]
    );
    this.persist();
  }

  private persist(): void {
    if (!this.db) return;
    const data = this.db.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const scraperDb = new ScraperDatabase();
