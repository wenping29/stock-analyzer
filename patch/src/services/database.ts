import initSqlJs, { Database as SqlJsDatabase, Statement, SqlJsStatic } from "sql.js";
import * as fs from "fs";
import * as path from "path";
import type { KlineData, MonitorJob, StockInfo } from "@shared/types";

const DB_PATH = path.join(__dirname, "../../data/stock_data.db");

export class StockDatabase {
  private db: SqlJsDatabase | null = null;
  private sql: SqlJsStatic | null = null;

  async init(): Promise<void> {
    this.sql = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new this.sql.Database(new Uint8Array(buffer));
    } else {
      this.db = new this.sql.Database();
    }

    this.db.run("PRAGMA foreign_keys = ON;");

    this.createTables();
  }

  private createTables(): void {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");

    db.run(`
      CREATE TABLE IF NOT EXISTS kline_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'daily',
        date TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume REAL,
        amount REAL,
        UNIQUE(code, period, date)
      )
    `);
    db.run("CREATE INDEX IF NOT EXISTS idx_kline_code_period ON kline_data(code, period);");
    db.run("CREATE INDEX IF NOT EXISTS idx_kline_date ON kline_data(date);");

    db.run(`
      CREATE TABLE IF NOT EXISTS monitor_jobs (
        id TEXT PRIMARY KEY,
        name TEXT,
        config TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS monitoring_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT REFERENCES monitor_jobs(id),
        run_at TEXT DEFAULT (datetime('now')),
        entry_signals TEXT,
        exit_signals TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS stock_list (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        market TEXT,
        industry TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.run("CREATE INDEX IF NOT EXISTS idx_stock_list_market ON stock_list(market);");
    db.run("CREATE INDEX IF NOT EXISTS idx_stock_list_name ON stock_list(name);");
  }

  persist(): void {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    const data = db.export();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  getMonitorJobs(): MonitorJob[] {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    const stmt: Statement = db.prepare("SELECT config FROM monitor_jobs WHERE enabled = 1;");
    const jobs: MonitorJob[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (row.config) {
        jobs.push(JSON.parse(row.config as string));
      }
    }
    stmt.free();
    return jobs;
  }

  saveMonitoringRun(jobId: string, entrySignals: unknown, exitSignals: unknown): void {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    db.run(
      "INSERT INTO monitoring_results (job_id, entry_signals, exit_signals) VALUES (?, ?, ?);",
      [jobId, JSON.stringify(entrySignals), JSON.stringify(exitSignals)]
    );
  }

  saveStockList(stocks: { code: string; name: string; market?: string; industry?: string }[]): void {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    db.run("BEGIN TRANSACTION;");
    for (const stock of stocks) {
      db.run(
        "INSERT OR REPLACE INTO stock_list (code, name, market, industry, updated_at) VALUES (?, ?, ?, ?, datetime('now'));",
        [stock.code, stock.name, stock.market ?? null, stock.industry ?? null]
      );
    }
    db.run("COMMIT;");
  }

  getStockList(): { code: string; name: string; market?: string; industry?: string; updated_at?: string }[] {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    const stmt: Statement = db.prepare(
      "SELECT code, name, market, industry, updated_at FROM stock_list;"
    );
    const result: { code: string; name: string; market?: string; industry?: string; updated_at?: string }[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push({
        code: row.code as string,
        name: row.name as string,
        market: (row.market as string) ?? undefined,
        industry: (row.industry as string) ?? undefined,
        updated_at: (row.updated_at as string) ?? undefined,
      });
    }
    stmt.free();
    return result;
  }

  getKline(code: string, period: string, startDate: string, endDate: string): KlineData[] {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    const stmt: Statement = db.prepare(
      "SELECT date, open, high, low, close, volume, amount FROM kline_data WHERE code = ? AND period = ? AND date >= ? AND date <= ? ORDER BY date;"
    );
    stmt.bind([code, period, startDate, endDate]);
    const result: KlineData[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push({
        date: row.date as string,
        open: row.open as number,
        high: row.high as number,
        low: row.low as number,
        close: row.close as number,
        volume: row.volume as number,
        amount: (row.amount as number) ?? 0,
      });
    }
    stmt.free();
    return result;
  }

  saveKline(code: string, period: string, rows: KlineData[]): void {
    const db = this.db;
    if (!db) throw new Error("Database not initialized");
    db.run("BEGIN TRANSACTION;");
    const stmt: Statement = db.prepare(
      "INSERT OR REPLACE INTO kline_data (code, period, date, open, high, low, close, volume, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);"
    );
    for (const row of rows) {
      stmt.bind([code, period, row.date, row.open, row.high, row.low, row.close, row.volume, row.amount ?? null]);
      stmt.step();
      stmt.reset();
    }
    stmt.free();
    db.run("COMMIT;");
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.sql = null;
  }
}

export const db = new StockDatabase();
