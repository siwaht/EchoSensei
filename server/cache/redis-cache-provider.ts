import redisClient from '../redis/redis-client';
import { CacheProvider } from './cache-manager';

interface CacheOptions {
  ttl?: number;
  max?: number;
  region?: string;
  compress?: boolean;
}

export class RedisCacheProvider extends CacheProvider {
  private prefix: string;

  constructor(prefix: string = 'cache') {
    super();
    this.prefix = prefix;
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redisClient.get(this.getKey(key));
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl ? Math.floor(options.ttl / 1000) : 300; // Default 5 minutes
      const data = JSON.stringify(value);
      await redisClient.set(this.getKey(key), data, ttl);
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redisClient.del(this.getKey(key));
    } catch (error) {
      console.error('Redis cache delete error:', error);
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      const searchPattern = pattern 
        ? `${this.prefix}:${pattern}`
        : `${this.prefix}:*`;
      
      const keys = await redisClient.scan(searchPattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Redis cache clear error:', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return await redisClient.exists(this.getKey(key));
    } catch (error) {
      console.error('Redis cache has error:', error);
      return false;
    }
  }

  async getStats(): Promise<any> {
    try {
      const keys = await redisClient.scan(`${this.prefix}:*`);
      return {
        size: keys.length,
        provider: 'redis',
        available: redisClient.isAvailable()
      };
    } catch (error) {
      console.error('Redis cache stats error:', error);
      return {
        size: 0,
        provider: 'redis',
        available: false
      };
    }
  }

  // Batch operations for efficiency
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const redisKeys = keys.map(key => this.getKey(key));
      const values = await redisClient.mget(...redisKeys);
      
      return values.map(value => {
        if (value) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return null;
          }
        }
        return null;
      });
    } catch (error) {
      console.error('Redis cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Record<string, T>, ttl?: number): Promise<void> {
    try {
      const pipeline = redisClient.pipeline();
      
      if (pipeline) {
        for (const [key, value] of Object.entries(keyValuePairs)) {
          const redisKey = this.getKey(key);
          const data = JSON.stringify(value);
          
          if (ttl) {
            pipeline.setex(redisKey, Math.floor(ttl / 1000), data);
          } else {
            pipeline.set(redisKey, data);
          }
        }
        
        await pipeline.exec();
      } else {
        // Fallback to individual sets if pipeline not available
        for (const [key, value] of Object.entries(keyValuePairs)) {
          await this.set(key, value, { ttl });
        }
      }
    } catch (error) {
      console.error('Redis cache mset error:', error);
    }
  }

  // Cache warming
  async warm<T>(keys: string[], fetcher: (key: string) => Promise<T>, ttl?: number): Promise<void> {
    try {
      const missing: string[] = [];
      
      // Check which keys are missing
      for (const key of keys) {
        const exists = await this.has(key);
        if (!exists) {
          missing.push(key);
        }
      }
      
      // Fetch missing keys in parallel
      if (missing.length > 0) {
        const results = await Promise.all(
          missing.map(async key => {
            try {
              const value = await fetcher(key);
              return { key, value };
            } catch (error) {
              console.error(`Failed to fetch key ${key}:`, error);
              return null;
            }
          })
        );
        
        // Store fetched values
        const toStore: Record<string, T> = {};
        for (const result of results) {
          if (result) {
            toStore[result.key] = result.value;
          }
        }
        
        if (Object.keys(toStore).length > 0) {
          await this.mset(toStore, ttl);
        }
      }
    } catch (error) {
      console.error('Redis cache warm error:', error);
    }
  }
}

// Factory function to create Redis cache provider if available
export function createRedisCacheProvider(prefix?: string): RedisCacheProvider | null {
  if (redisClient.isAvailable()) {
    return new RedisCacheProvider(prefix);
  }
  return null;
}

export default RedisCacheProvider;