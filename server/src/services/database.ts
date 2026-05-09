import * as fs from "fs";
import * as path from "path";
import initSqlJs, { Database as SqlJsDatabase, Statement, SqlJsStatic } from "sql.js";
import type { KlineData, Trade, BacktestResult, ScreeningResult, MonitorJob } from "@shared/types";

const DB_PATH = path.join(__dirname, "../../data/stock_data.db");

interface DbTrade {
  backtest_id: string;
  code: string;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  shares: number;
  pnl: number;
  pnl_pct: number;
  exit_reason: string;
}

class StockDatabase {
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
    this.db.run("PRAGMA foreign_keys = ON");
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS kline_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'daily',
        date TEXT NOT NULL,
        open REAL, high REAL, low REAL, close REAL,
        volume REAL, amount REAL,
        UNIQUE(code, period, date)
      )
    `);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_kline_code_period ON kline_data(code, period)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_kline_date ON kline_data(date)");

    this.db.run(`
      CREATE TABLE IF NOT EXISTS backtest_results (
        id TEXT PRIMARY KEY,
        name TEXT,
        config TEXT,
        metrics TEXT,
        equity_curve TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backtest_id TEXT REFERENCES backtest_results(id),
        code TEXT,
        entry_date TEXT,
        entry_price REAL,
        exit_date TEXT,
        exit_price REAL,
        shares INTEGER,
        pnl REAL,
        pnl_pct REAL,
        exit_reason TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS screening_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        code TEXT,
        name TEXT,
        close REAL,
        change_pct REAL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS monitor_jobs (
        id TEXT PRIMARY KEY,
        name TEXT,
        config TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS monitoring_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT REFERENCES monitor_jobs(id),
        run_at TEXT DEFAULT (datetime('now')),
        entry_signals TEXT,
        exit_signals TEXT
      )
    `);
  }

  // ---- Persistence ----

  persist(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, buffer);
  }

  // ---- K-line operations ----

  insertKlineBatch(rows: { code: string; period: string; date: string; open: number; high: number; low: number; close: number; volume: number; amount: number }[]): void {
    if (!this.db || rows.length === 0) return;

    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO kline_data (code, period, date, open, high, low, close, volume, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    this.db.run("BEGIN TRANSACTION");
    for (const r of rows) {
      stmt.run([r.code, r.period, r.date, r.open, r.high, r.low, r.close, r.volume, r.amount]);
    }
    this.db.run("COMMIT");
    stmt.free();
    this.persist();
  }

  getKline(code: string, period: string, start: string, end: string): KlineData[] {
    if (!this.db) return [];

    const stmt = this.db.prepare(
      "SELECT date, open, high, low, close, volume, amount FROM kline_data WHERE code = ? AND period = ? AND date >= ? AND date <= ? ORDER BY date ASC"
    );
    stmt.bind([code, period, start, end]);

    const results: KlineData[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        date: row.date as string,
        open: row.open as number,
        high: row.high as number,
        low: row.low as number,
        close: row.close as number,
        volume: row.volume as number,
        amount: row.amount as number,
      });
    }
    stmt.free();
    return results;
  }

  hasKline(code: string, period: string): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare("SELECT COUNT(*) as cnt FROM kline_data WHERE code = ? AND period = ?");
    stmt.bind([code, period]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return (row.cnt as number) > 0;
  }

  getAvailableDateRange(code: string, period: string): { minDate: string; maxDate: string } | null {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT MIN(date) as minDate, MAX(date) as maxDate FROM kline_data WHERE code = ? AND period = ?");
    stmt.bind([code, period]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    if (!row.minDate || !row.maxDate) return null;
    return { minDate: row.minDate as string, maxDate: row.maxDate as string };
  }

  // ---- Backtest operations ----

  saveBacktestResult(id: string, name: string, config: unknown, metrics: unknown, equityCurve: unknown): void {
    if (!this.db) return;
    this.db.run(
      "INSERT OR REPLACE INTO backtest_results (id, name, config, metrics, equity_curve) VALUES (?, ?, ?, ?, ?)",
      [id, name, JSON.stringify(config), JSON.stringify(metrics), JSON.stringify(equityCurve)]
    );
    this.persist();
  }

  getBacktestResult(id: string): { id: string; name: string; config: string; metrics: string; equity_curve: string; created_at: string } | null {
    if (!this.db) return null;
    const stmt = this.db.prepare("SELECT * FROM backtest_results WHERE id = ?");
    stmt.bind([id]);
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject();
    stmt.free();
    return row as any;
  }

  listBacktestResults(): { id: string; name: string; created_at: string }[] {
    if (!this.db) return [];
    const results: any[] = [];
    const stmt = this.db.prepare("SELECT id, name, created_at FROM backtest_results ORDER BY created_at DESC");
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // ---- Trade operations ----

  saveTrades(backtestId: string, trades: Trade[]): void {
    if (!this.db || trades.length === 0) return;

    const stmt = this.db.prepare(
      "INSERT INTO trades (backtest_id, code, entry_date, entry_price, exit_date, exit_price, shares, pnl, pnl_pct, exit_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    this.db.run("BEGIN TRANSACTION");
    for (const t of trades) {
      stmt.run([backtestId, t.code, t.entryDate, t.entryPrice, t.exitDate, t.exitPrice, t.shares, t.pnl, t.pnlPct, t.exitReason]);
    }
    this.db.run("COMMIT");
    stmt.free();
    this.persist();
  }

  getTrades(backtestId: string): Trade[] {
    if (!this.db) return [];

    const stmt = this.db.prepare("SELECT * FROM trades WHERE backtest_id = ? ORDER BY entry_date");
    stmt.bind([backtestId]);

    const results: Trade[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as unknown as DbTrade;
      results.push({
        code: row.code,
        entryDate: row.entry_date,
        entryPrice: row.entry_price,
        exitDate: row.exit_date,
        exitPrice: row.exit_price,
        shares: row.shares,
        pnl: row.pnl,
        pnlPct: row.pnl_pct,
        exitReason: row.exit_reason,
      });
    }
    stmt.free();
    return results;
  }

  // ---- Screening results ----

  saveScreeningResult(runId: string, results: ScreeningResult[]): void {
    if (!this.db || results.length === 0) return;

    const stmt = this.db.prepare(
      "INSERT INTO screening_results (run_id, code, name, close, change_pct) VALUES (?, ?, ?, ?, ?)"
    );

    this.db.run("BEGIN TRANSACTION");
    for (const r of results) {
      stmt.run([runId, r.code, r.name, r.close, r.changePct]);
    }
    this.db.run("COMMIT");
    stmt.free();
    this.persist();
  }

  // ---- Monitor jobs ----

  saveMonitorJob(job: MonitorJob): void {
    if (!this.db) return;
    this.db.run(
      "INSERT OR REPLACE INTO monitor_jobs (id, name, config, enabled) VALUES (?, ?, ?, ?)",
      [job.id, job.name, JSON.stringify(job), job.enabled ? 1 : 0]
    );
    this.persist();
  }

  getMonitorJobs(): MonitorJob[] {
    if (!this.db) return [];
    const stmt = this.db.prepare("SELECT config FROM monitor_jobs WHERE enabled = 1");
    const results: MonitorJob[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      try {
        results.push(JSON.parse(row.config as string));
      } catch { /* skip corrupt entries */ }
    }
    stmt.free();
    return results;
  }

  deleteMonitorJob(id: string): void {
    if (!this.db) return;
    this.db.run("DELETE FROM monitor_jobs WHERE id = ?", [id]);
    this.persist();
  }

  saveMonitoringRun(jobId: string, entrySignals: unknown, exitSignals: unknown): void {
    if (!this.db) return;
    this.db.run(
      "INSERT INTO monitoring_results (job_id, entry_signals, exit_signals) VALUES (?, ?, ?)",
      [jobId, JSON.stringify(entrySignals), JSON.stringify(exitSignals)]
    );
    this.persist();
  }

  // ---- Utility ----

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export const db = new StockDatabase();
