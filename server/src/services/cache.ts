import * as fs from "fs/promises";
import * as path from "path";

const CACHE_DIR = path.join(__dirname, "../../data");

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  _key?: string; // persisted original key for disk recovery
}

class DataCacheManager {
  private store = new Map<string, CacheEntry<any>>();
  private pending = new Map<string, Promise<any>>();
  private initialized = false;

  /** Ensure cache dir exists and load existing cache files */
  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await this.loadFromDisk();
    this.initialized = true;
  }

  private filePath(key: string): string {
    const safe = key.replace(/[<>:"/\\|?*]/g, "_");
    return path.join(CACHE_DIR, `${safe}.json`);
  }

  private async loadFromDisk(): Promise<void> {
    const files = await fs.readdir(CACHE_DIR).catch(() => [] as string[]);
    const now = Date.now();
    let loaded = 0;
    let cleaned = 0;
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const fp = path.join(CACHE_DIR, file);
      try {
        const raw = await fs.readFile(fp, "utf-8");
        const entry: CacheEntry<any> = JSON.parse(raw);
        if (entry.expiresAt > now && entry._key) {
          this.store.set(entry._key, entry);
          loaded++;
        } else {
          await fs.unlink(fp).catch(() => {});
          cleaned++;
        }
      } catch {
        await fs.unlink(fp).catch(() => {});
        cleaned++;
      }
    }
    if (loaded > 0 || cleaned > 0) {
      console.log(`[cache] Loaded ${loaded} entries, cleaned ${cleaned} expired from disk`);
    }
  }

  private async persistToDisk<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const fp = this.filePath(key);
      const payload = { ...entry, _key: key };
      await fs.writeFile(fp, JSON.stringify(payload), "utf-8");
    } catch {
      // Silent fail — memory cache still works
    }
  }

  private async removeFromDisk(key: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(key));
    } catch {
      // File may not exist
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.removeFromDisk(key); // fire and forget
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const entry = { data, expiresAt: Date.now() + ttlMs };
    this.store.set(key, entry);
    this.persistToDisk(key, entry); // fire and forget
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlMs: number = 24 * 60 * 60 * 1000
  ): Promise<T> {
    await this.init();
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    // Deduplicate concurrent fetches
    const pending = this.pending.get(key);
    if (pending) return pending;

    const promise = fetchFn().then((data) => {
      this.set(key, data, ttlMs);
      this.pending.delete(key);
      return data;
    }).catch((err) => {
      this.pending.delete(key);
      throw err;
    });

    this.pending.set(key, promise);
    return promise;
  }

  async clearExpired(): Promise<void> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        await this.removeFromDisk(key);
      }
    }
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.pending.clear();
    // Clean all cache files
    const files = await fs.readdir(CACHE_DIR).catch(() => [] as string[]);
    for (const file of files) {
      if (file.endsWith(".json")) {
        await fs.unlink(path.join(CACHE_DIR, file)).catch(() => {});
      }
    }
  }
}

export const cacheManager = new DataCacheManager();
