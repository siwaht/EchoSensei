import Redis from 'ioredis';

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // Connection pool settings for high concurrency
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  
  // Performance optimizations
  enableOfflineQueue: true,
  connectTimeout: 10000,
  
  // Automatic reconnection
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Connection pool for better concurrency
  lazyConnect: false,
  keepAlive: 10000,
  
  // Error handling
  reconnectOnError(err: Error) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      // Only reconnect when the error contains "READONLY"
      return true;
    }
    return false;
  }
};

class RedisClient {
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Main client for general operations
      this.client = new Redis(redisConfig);
      
      // Separate clients for pub/sub to avoid blocking
      this.subscriber = new Redis(redisConfig);
      this.publisher = new Redis(redisConfig);

      // Connection event handlers
      this.client.on('connect', () => {
        console.log('Redis connected successfully');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('Redis connection error:', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.log('Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('Redis reconnecting...');
      });

    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      // Continue without Redis - fallback to in-memory
      this.client = null;
      this.subscriber = null;
      this.publisher = null;
    }
  }

  // Get the main Redis client
  getClient(): Redis | null {
    return this.client;
  }

  // Get pub/sub clients
  getSubscriber(): Redis | null {
    return this.subscriber;
  }

  getPublisher(): Redis | null {
    return this.publisher;
  }

  // Check if Redis is available
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Cache operations with fallback
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      if (ttl) {
        await this.client!.setex(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key: string | string[]): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      if (Array.isArray(key)) {
        return await this.client!.del(...key);
      } else {
        return await this.client!.del(key);
      }
    } catch (error) {
      console.error('Redis del error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return (await this.client!.exists(key)) === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }

  // Hash operations for structured data
  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.hget(key, field);
    } catch (error) {
      console.error('Redis hget error:', error);
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      await this.client!.hset(key, field, value);
      return true;
    } catch (error) {
      console.error('Redis hset error:', error);
      return false;
    }
  }

  async hgetall(key: string): Promise<Record<string, string> | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.hgetall(key);
    } catch (error) {
      console.error('Redis hgetall error:', error);
      return null;
    }
  }

  // List operations for queues
  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.lpush(key, ...values);
    } catch (error) {
      console.error('Redis lpush error:', error);
      return 0;
    }
  }

  async rpop(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.rpop(key);
    } catch (error) {
      console.error('Redis rpop error:', error);
      return null;
    }
  }

  // Set operations for unique collections
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.sadd(key, ...members);
    } catch (error) {
      console.error('Redis sadd error:', error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.isAvailable()) return [];
    try {
      return await this.client!.smembers(key);
    } catch (error) {
      console.error('Redis smembers error:', error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return (await this.client!.sismember(key, member)) === 1;
    } catch (error) {
      console.error('Redis sismember error:', error);
      return false;
    }
  }

  // Increment operations for counters
  async incr(key: string): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      return 0;
    }
  }

  async incrby(key: string, increment: number): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.incrby(key, increment);
    } catch (error) {
      console.error('Redis incrby error:', error);
      return 0;
    }
  }

  // Expiration operations
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      return (await this.client!.expire(key, seconds)) === 1;
    } catch (error) {
      console.error('Redis expire error:', error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) return -1;
    try {
      return await this.client!.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }

  // Pattern-based operations
  async keys(pattern: string): Promise<string[]> {
    if (!this.isAvailable()) return [];
    try {
      return await this.client!.keys(pattern);
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  // Scan for better performance with large datasets
  async scan(pattern: string, count: number = 100): Promise<string[]> {
    if (!this.isAvailable()) return [];
    try {
      const result: string[] = [];
      const stream = this.client!.scanStream({
        match: pattern,
        count: count
      });

      return new Promise((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          result.push(...keys);
        });
        stream.on('end', () => {
          resolve(result);
        });
        stream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error('Redis scan error:', error);
      return [];
    }
  }

  // Batch operations for efficiency
  async mget(...keys: string[]): Promise<(string | null)[]> {
    if (!this.isAvailable()) return keys.map(() => null);
    try {
      return await this.client!.mget(...keys);
    } catch (error) {
      console.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(keyValuePairs: Record<string, string>): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const args: string[] = [];
      for (const [key, value] of Object.entries(keyValuePairs)) {
        args.push(key, value);
      }
      await this.client!.mset(...args);
      return true;
    } catch (error) {
      console.error('Redis mset error:', error);
      return false;
    }
  }

  // Pipeline for atomic operations
  pipeline() {
    if (!this.isAvailable()) return null;
    return this.client!.pipeline();
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<number> {
    if (!this.publisher) return 0;
    try {
      return await this.publisher.publish(channel, message);
    } catch (error) {
      console.error('Redis publish error:', error);
      return 0;
    }
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscriber) return;
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          callback(message);
        }
      });
    } catch (error) {
      console.error('Redis subscribe error:', error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) return;
    try {
      await this.subscriber.unsubscribe(channel);
    } catch (error) {
      console.error('Redis unsubscribe error:', error);
    }
  }

  // Cleanup
  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
      }
      if (this.subscriber) {
        await this.subscriber.quit();
      }
      if (this.publisher) {
        await this.publisher.quit();
      }
      this.isConnected = false;
    } catch (error) {
      console.error('Redis disconnect error:', error);
    }
  }
}

// Export singleton instance
export const redisClient = new RedisClient();

// Export the Redis type for use elsewhere
export type { Redis };

export default redisClient;