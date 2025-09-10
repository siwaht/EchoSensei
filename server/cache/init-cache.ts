import { initializeCacheManager } from './cache-manager';
import { createRedisCacheProvider } from './redis-cache-provider';
import redisClient from '../redis/redis-client';

// Initialize cache manager with Redis if available
export function initializeCache() {
  console.log('Initializing cache system...');
  
  // Create Redis provider if Redis is available
  const redisProvider = createRedisCacheProvider();
  
  if (redisProvider) {
    console.log('Redis cache provider initialized successfully');
  } else {
    console.log('Redis not available, falling back to in-memory cache');
  }
  
  // Initialize cache manager with Redis as L2 cache
  const cacheManager = initializeCacheManager({
    defaultTTL: 5 * 60 * 1000, // 5 minutes default
    l2Provider: redisProvider || undefined
  });
  
  // Log cache statistics periodically (every 5 minutes)
  setInterval(() => {
    const stats = cacheManager.getAllStats();
    console.log('Cache statistics:', JSON.stringify(stats, null, 2));
  }, 5 * 60 * 1000);
  
  return cacheManager;
}

// Export for use in other modules
export { getCacheManager } from './cache-manager';
export default initializeCache;