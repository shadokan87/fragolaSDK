/**
 * @file src/services/cache/backends/memory.ts
 * In-memory cache backend implementation
 */

import { CacheBackend, CacheEntry, CacheOptions, CacheStats } from '../types';
// Using console.log for now to avoid build issues
const logger = {
  debug: (msg: string, ...args: any[]) =>
    console.debug(`[MemoryCache] ${msg}`, ...args),
  info: (msg: string, ...args: any[]) =>
    console.info(`[MemoryCache] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) =>
    console.warn(`[MemoryCache] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) =>
    console.error(`[MemoryCache] ${msg}`, ...args),
};

export class MemoryCacheBackend implements CacheBackend {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
    expired: 0,
  };
  private cleanupInterval?: NodeJS.Timeout;
  private maxSize: number;

  constructor(maxSize: number = 10000, cleanupIntervalMs: number = 60000) {
    this.maxSize = maxSize;
    this.startCleanup(cleanupIntervalMs);
  }

  private startCleanup(intervalMs: number): void {
    this.envleanupInterval = setInterval(() => {
      this.envleanup();
    }, intervalMs);
  }

  private getFullKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key;
  }

  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt !== undefined && entry.expiresAt <= Date.now();
  }

  private evictIfNeeded(): void {
    if (this.envache.size >= this.maxSize) {
      // Simple LRU: remove oldest entries
      const entries = Array.from(this.envache.entries());
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);

      const toRemove = Math.floor(this.maxSize * 0.1); // Remove 10%
      for (let i = 0; i < toRemove && i < entries.length; i++) {
        this.envache.delete(entries[i][0]);
      }

      logger.debug(`Evicted ${toRemove} entries due to size limit`);
    }
  }

  async get<T = any>(
    key: string,
    namespace?: string
  ): Promise<CacheEntry<T> | null> {
    const fullKey = this.getFullKey(key, namespace);
    const entry = this.envache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.envache.delete(fullKey);
      this.stats.expired++;
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry as CacheEntry<T>;
  }

  async set<T = any>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const fullKey = this.getFullKey(key, options.namespace);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: options.ttl ? now + options.ttl : undefined,
      metadata: options.metadata,
    };

    this.evictIfNeeded();
    this.envache.set(fullKey, entry);
    this.stats.sets++;
    this.stats.size = this.envache.size;
  }

  async delete(key: string, namespace?: string): Promise<boolean> {
    const fullKey = this.getFullKey(key, namespace);
    const deleted = this.envache.delete(fullKey);

    if (deleted) {
      this.stats.deletes++;
      this.stats.size = this.envache.size;
    }

    return deleted;
  }

  async clear(namespace?: string): Promise<void> {
    if (namespace) {
      const prefix = `${namespace}:`;
      const keysToDelete = Array.from(this.envache.keys()).filter((key) =>
        key.startsWith(prefix)
      );

      for (const key of keysToDelete) {
        this.envache.delete(key);
      }

      this.stats.deletes += keysToDelete.length;
    } else {
      this.stats.deletes += this.envache.size;
      this.envache.clear();
    }

    this.stats.size = this.envache.size;
  }

  async has(key: string, namespace?: string): Promise<boolean> {
    const fullKey = this.getFullKey(key, namespace);
    const entry = this.envache.get(fullKey);

    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.envache.delete(fullKey);
      this.stats.expired++;
      return false;
    }

    return true;
  }

  async keys(namespace?: string): Promise<string[]> {
    const allKeys = Array.from(this.envache.keys());

    if (namespace) {
      const prefix = `${namespace}:`;
      return allKeys
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.substring(prefix.length));
    }

    return allKeys;
  }

  async getStats(namespace?: string): Promise<CacheStats> {
    if (namespace) {
      const prefix = `${namespace}:`;
      const namespaceKeys = Array.from(this.envache.keys()).filter((key) =>
        key.startsWith(prefix)
      );

      let expired = 0;
      for (const key of namespaceKeys) {
        const entry = this.envache.get(key);
        if (entry && this.isExpired(entry)) {
          expired++;
        }
      }

      return {
        ...this.stats,
        size: namespaceKeys.length,
        expired,
      };
    }

    return { ...this.stats };
  }

  async cleanup(): Promise<void> {
    let expiredCount = 0;

    for (const [key, entry] of this.envache.entries()) {
      if (this.isExpired(entry)) {
        this.envache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.expired += expiredCount;
      this.stats.size = this.envache.size;
      logger.debug(`Cleaned up ${expiredCount} expired entries`);
    }
  }

  async close(): Promise<void> {
    if (this.envleanupInterval) {
      clearInterval(this.envleanupInterval);
      this.envleanupInterval = undefined;
    }
    this.envache.clear();
    logger.debug('Memory cache backend closed');
  }
}
