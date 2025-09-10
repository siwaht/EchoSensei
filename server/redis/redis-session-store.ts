import session from 'express-session';
import redisClient from './redis-client';

// Create a Redis session store if Redis is available, otherwise fallback
export function createSessionStore() {
  if (redisClient.isAvailable()) {
    // Use Redis for session storage
    return {
      get: async (sid: string, callback: (err: any, session?: any) => void) => {
        try {
          const data = await redisClient.get(`sess:${sid}`);
          if (data) {
            callback(null, JSON.parse(data));
          } else {
            callback(null, null);
          }
        } catch (error) {
          callback(error);
        }
      },

      set: async (sid: string, session: any, callback?: (err?: any) => void) => {
        try {
          const ttl = session.cookie?.maxAge ? Math.floor(session.cookie.maxAge / 1000) : 86400; // Default 24 hours
          await redisClient.set(`sess:${sid}`, JSON.stringify(session), ttl);
          if (callback) callback();
        } catch (error) {
          if (callback) callback(error);
        }
      },

      destroy: async (sid: string, callback?: (err?: any) => void) => {
        try {
          await redisClient.del(`sess:${sid}`);
          if (callback) callback();
        } catch (error) {
          if (callback) callback(error);
        }
      },

      touch: async (sid: string, session: any, callback?: (err?: any) => void) => {
        try {
          const ttl = session.cookie?.maxAge ? Math.floor(session.cookie.maxAge / 1000) : 86400;
          await redisClient.expire(`sess:${sid}`, ttl);
          if (callback) callback();
        } catch (error) {
          if (callback) callback(error);
        }
      },

      length: async (callback: (err: any, length?: number) => void) => {
        try {
          const keys = await redisClient.keys('sess:*');
          callback(null, keys.length);
        } catch (error) {
          callback(error);
        }
      },

      clear: async (callback?: (err?: any) => void) => {
        try {
          const keys = await redisClient.keys('sess:*');
          if (keys.length > 0) {
            await redisClient.del(keys);
          }
          if (callback) callback();
        } catch (error) {
          if (callback) callback(error);
        }
      },

      all: async (callback: (err: any, sessions?: { [sid: string]: any }) => void) => {
        try {
          const keys = await redisClient.keys('sess:*');
          const sessions: { [sid: string]: any } = {};
          
          if (keys.length > 0) {
            const values = await redisClient.mget(...keys);
            keys.forEach((key, index) => {
              const sid = key.replace('sess:', '');
              const value = values[index];
              if (value) {
                sessions[sid] = JSON.parse(value);
              }
            });
          }
          
          callback(null, sessions);
        } catch (error) {
          callback(error);
        }
      }
    };
  }
  
  // Fallback: return null to use default MemoryStore
  return null;
}

// Session cleanup job (runs every hour)
export function startSessionCleanup() {
  if (redisClient.isAvailable()) {
    setInterval(async () => {
      try {
        // Get all session keys
        const keys = await redisClient.keys('sess:*');
        
        for (const key of keys) {
          const ttl = await redisClient.ttl(key);
          // Remove sessions with negative TTL (expired)
          if (ttl < 0) {
            await redisClient.del(key);
          }
        }
      } catch (error) {
        console.error('Session cleanup error:', error);
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

export default createSessionStore;