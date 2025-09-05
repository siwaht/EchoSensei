import { LRUCache } from 'lru-cache';
import crypto from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  max?: number; // Maximum number of items
  region?: string; // Cache region for multi-region support
  compress?: boolean; // Whether to compress values
}

interface CacheEntry<T = any> {
  value: T;
  expires: number;
  compressed?: boolean;
  region?: string;
  tags?: string[];
}

// Abstract cache interface
abstract class CacheProvider {
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract clear(pattern?: string): Promise<void>;
  abstract has(key: string): Promise<boolean>;
  abstract getStats(): Promise<any>;
}

// In-memory LRU cache implementation
class MemoryCacheProvider extends CacheProvider {
  private cache: LRUCache<string, CacheEntry>;

  constructor(options: { max?: number; ttl?: number } = {}) {
    super();
    this.cache = new LRUCache({
      max: options.max || 1000,
      ttl: options.ttl || 1000 * 60 * 5, // 5 minutes default
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expires && Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const expires = options?.ttl ? Date.now() + options.ttl : 0;
    
    this.cache.set(key, {
      value,
      expires,
      region: options?.region,
      compressed: false,
    });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
    } else {
      // Clear keys matching pattern
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of Array.from(this.cache.keys())) {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      }
    }
  }

  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  async getStats(): Promise<any> {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      calculatedSize: this.cache.calculatedSize,
      disposed: this.cache.size,
    };
  }
}

// Multi-tier cache with L1 (memory) and L2 (distributed) layers
class MultiTierCache {
  private l1Cache: MemoryCacheProvider;
  private l2Cache?: CacheProvider; // Could be Redis or another distributed cache
  private readonly namespace: string;
  private stats = {
    hits: 0,
    misses: 0,
    l1Hits: 0,
    l2Hits: 0,
  };

  constructor(namespace: string = 'default', options?: {
    l1Options?: { max?: number; ttl?: number };
    l2Provider?: CacheProvider;
  }) {
    this.namespace = namespace;
    this.l1Cache = new MemoryCacheProvider(options?.l1Options || {});
    this.l2Cache = options?.l2Provider;
  }

  private makeKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const nsKey = this.makeKey(key);
    
    // Try L1 cache first
    const l1Value = await this.l1Cache.get<T>(nsKey);
    if (l1Value !== null) {
      this.stats.hits++;
      this.stats.l1Hits++;
      return l1Value;
    }
    
    // Try L2 cache if available
    if (this.l2Cache) {
      const l2Value = await this.l2Cache.get<T>(nsKey);
      if (l2Value !== null) {
        // Populate L1 cache with L2 value
        await this.l1Cache.set(nsKey, l2Value, { ttl: 60000 }); // 1 minute in L1
        this.stats.hits++;
        this.stats.l2Hits++;
        return l2Value;
      }
    }
    
    this.stats.misses++;
    return null;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const nsKey = this.makeKey(key);
    
    // Set in both L1 and L2
    await this.l1Cache.set(nsKey, value, options);
    if (this.l2Cache) {
      await this.l2Cache.set(nsKey, value, options);
    }
  }

  async delete(key: string): Promise<void> {
    const nsKey = this.makeKey(key);
    
    await this.l1Cache.delete(nsKey);
    if (this.l2Cache) {
      await this.l2Cache.delete(nsKey);
    }
  }

  async clear(pattern?: string): Promise<void> {
    const nsPattern = pattern ? `${this.namespace}:${pattern}` : `${this.namespace}:*`;
    
    await this.l1Cache.clear(nsPattern);
    if (this.l2Cache) {
      await this.l2Cache.clear(nsPattern);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    // Implement tag-based invalidation
    // This would require tracking keys by tags
  }

  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      l1HitRate: this.stats.l1Hits / this.stats.hits || 0,
      l2HitRate: this.stats.l2Hits / this.stats.hits || 0,
    };
  }

  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l2Hits: 0,
    };
  }
}

// Cache manager for different cache namespaces
class CacheManager {
  private caches: Map<string, MultiTierCache> = new Map();
  private defaultTTL = 1000 * 60 * 5; // 5 minutes
  
  constructor(private options?: {
    defaultTTL?: number;
    l2Provider?: CacheProvider;
  }) {
    if (options?.defaultTTL) {
      this.defaultTTL = options.defaultTTL;
    }
  }

  getCache(namespace: string = 'default'): MultiTierCache {
    if (!this.caches.has(namespace)) {
      this.caches.set(namespace, new MultiTierCache(namespace, {
        l2Provider: this.options?.l2Provider
      }));
    }
    return this.caches.get(namespace)!;
  }

  // Helper method for caching function results
  async memoize<T>(
    key: string,
    fn: () => Promise<T>,
    options?: {
      namespace?: string;
      ttl?: number;
      force?: boolean;
    }
  ): Promise<T> {
    const cache = this.getCache(options?.namespace || 'default');
    
    if (!options?.force) {
      const cached = await cache.get<T>(key);
      if (cached !== null) {
        return cached;
      }
    }
    
    const result = await fn();
    await cache.set(key, result, {
      ttl: options?.ttl || this.defaultTTL
    });
    
    return result;
  }

  // Create cache key from object
  createKey(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  // Invalidate multiple caches
  async invalidate(patterns: { namespace: string; pattern?: string }[]): Promise<void> {
    await Promise.all(
      patterns.map(({ namespace, pattern }) => {
        const cache = this.getCache(namespace);
        return cache.clear(pattern);
      })
    );
  }

  // Get global statistics
  getAllStats() {
    const stats: Record<string, any> = {};
    this.caches.forEach((cache, namespace) => {
      stats[namespace] = cache.getStats();
    });
    return stats;
  }
}

// Query result cache decorator
export function cacheable(options?: {
  namespace?: string;
  ttl?: number;
  keyGenerator?: (...args: any[]) => string;
}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheManager = getCacheManager();
      const key = options?.keyGenerator 
        ? options.keyGenerator(...args)
        : cacheManager.createKey({ method: propertyKey, args });
      
      return cacheManager.memoize(
        key,
        () => originalMethod.apply(this, args),
        {
          namespace: options?.namespace || 'methods',
          ttl: options?.ttl
        }
      );
    };
    
    return descriptor;
  };
}

// Singleton instance
let cacheManager: CacheManager | null = null;

export function initializeCacheManager(options?: any) {
  if (!cacheManager) {
    cacheManager = new CacheManager(options);
  }
  return cacheManager;
}

export function getCacheManager() {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}

export { CacheManager, MultiTierCache, MemoryCacheProvider, CacheProvider };