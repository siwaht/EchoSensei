import { initializeDatabaseManager } from './db-replicas';
import { initializeCacheManager } from './cache/cache-manager';
import { initializeServiceRegistry, initializeAPIGateway } from './services/service-registry';
import { initializeEdgeManager } from './cdn/edge-config';
import { initializePerformanceMonitor, performanceMiddleware, getHealthStatus } from './monitoring/performance-monitor';
import type { Express } from 'express';

// Scalability configuration
export interface ScalabilityConfig {
  enableReadReplicas: boolean;
  enableCaching: boolean;
  enableCDN: boolean;
  enableMetrics: boolean;
  enableServiceMesh: boolean;
  regions?: string[];
  cacheConfig?: {
    defaultTTL: number;
    maxSize: number;
  };
}

// Default configuration for different environments
const configs: Record<string, ScalabilityConfig> = {
  development: {
    enableReadReplicas: false,
    enableCaching: true,
    enableCDN: false,
    enableMetrics: true,
    enableServiceMesh: false,
    cacheConfig: {
      defaultTTL: 60000, // 1 minute
      maxSize: 100
    }
  },
  staging: {
    enableReadReplicas: true,
    enableCaching: true,
    enableCDN: true,
    enableMetrics: true,
    enableServiceMesh: false,
    regions: ['us-east-1'],
    cacheConfig: {
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000
    }
  },
  production: {
    enableReadReplicas: true,
    enableCaching: true,
    enableCDN: true,
    enableMetrics: true,
    enableServiceMesh: true,
    regions: ['us-east-1', 'us-west-1', 'eu-west-1', 'ap-southeast-1'],
    cacheConfig: {
      defaultTTL: 600000, // 10 minutes
      maxSize: 10000
    }
  }
};

// Initialize all scalability features
export async function initializeScalability(app: Express, env: string = 'development') {
  const config = configs[env] || configs.development;
  const initialized: string[] = [];

  try {
    // 1. Initialize database with read replicas
    if (config.enableReadReplicas) {
      initializeDatabaseManager({
        primary: {
          connectionString: process.env.DATABASE_URL!,
          maxConnections: 30
        },
        replicas: config.regions?.map(region => ({
          connectionString: process.env[`DATABASE_READ_URL_${region.toUpperCase().replace('-', '_')}`] || process.env.DATABASE_URL!,
          maxConnections: 20,
          region,
          weight: 1
        })) || []
      });
      initialized.push('Database Read Replicas');
    }

    // 2. Initialize caching layer
    if (config.enableCaching) {
      initializeCacheManager({
        defaultTTL: config.cacheConfig?.defaultTTL,
        // Add Redis provider if available
        l2Provider: process.env.REDIS_URL ? undefined : undefined // Would add Redis provider here
      });
      initialized.push('Multi-tier Caching');
    }

    // 3. Initialize CDN and edge configuration
    if (config.enableCDN) {
      initializeEdgeManager();
      initialized.push('CDN Edge Configuration');
      
      // Add CDN headers middleware
      app.use((req, res, next) => {
        const edgeManager = require('./cdn/edge-config').getEdgeManager();
        const region = require('./cdn/edge-config').detectRegion(req);
        const headers = edgeManager.getCDNHeaders(req.path, region);
        
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
        
        next();
      });
    }

    // 4. Initialize performance monitoring
    if (config.enableMetrics) {
      const monitor = initializePerformanceMonitor();
      
      // Add monitoring middleware
      app.use(performanceMiddleware(monitor));
      
      // Add health check endpoint
      app.get('/health', (req, res) => {
        const health = getHealthStatus(monitor);
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
      });
      
      // Add metrics endpoint
      app.get('/metrics', (req, res) => {
        const metrics = monitor.getPerformanceMetrics();
        res.json(metrics);
      });
      
      initialized.push('Performance Monitoring');
    }

    // 5. Initialize service mesh if enabled
    if (config.enableServiceMesh) {
      const registry = initializeServiceRegistry();
      const gateway = initializeAPIGateway({
        rateLimit: 1000,
        timeout: 30000,
        retries: 3
      });
      
      // Register current service
      registry.register({
        id: process.env.INSTANCE_ID || 'main-1',
        name: 'voiceai-dashboard',
        version: '1.0.0',
        endpoint: `http://localhost:${process.env.PORT || 5000}`,
        health: '/health',
        region: process.env.REGION || 'us-east-1',
        capabilities: ['api', 'webhooks', 'admin'],
        lastHeartbeat: new Date()
      });
      
      initialized.push('Service Mesh');
    }

    console.log('✅ Scalability Features Initialized:', initialized.join(', '));
    
    // Log configuration
    console.log('📊 Scalability Configuration:', {
      environment: env,
      ...config,
      initialized
    });

    return {
      success: true,
      initialized,
      config
    };
  } catch (error) {
    console.error('❌ Failed to initialize scalability features:', error);
    return {
      success: false,
      error,
      initialized
    };
  }
}

// Graceful shutdown handler
export async function shutdownScalability() {
  console.log('Shutting down scalability services...');
  
  try {
    const dbManager = require('./db-replicas').getDatabaseManager();
    await dbManager?.shutdown();
    
    console.log('✅ Scalability services shut down successfully');
  } catch (error) {
    console.error('Error during scalability shutdown:', error);
  }
}

// Export configuration for external use
export function getScalabilityConfig(env?: string): ScalabilityConfig {
  return configs[env || process.env.NODE_ENV || 'development'];
}

// Performance optimization helpers
export const ScalabilityHelpers = {
  // Get appropriate database connection
  getDB(isWrite: boolean = false, region?: string) {
    try {
      const { dbWrite, dbRead } = require('./db-replicas');
      return isWrite ? dbWrite() : dbRead(region);
    } catch {
      // Fallback to regular db if replicas not initialized
      const { db } = require('./db');
      return db();
    }
  },

  // Get cache manager
  getCache() {
    try {
      return require('./cache/cache-manager').getCacheManager();
    } catch {
      // Return null object pattern if cache not initialized
      return {
        getCache: () => ({
          get: async () => null,
          set: async () => {},
          clear: async () => {}
        }),
        memoize: async (key: string, fn: Function) => fn()
      };
    }
  },

  // Check if feature is enabled
  isEnabled(feature: keyof ScalabilityConfig): boolean {
    const config = getScalabilityConfig();
    return !!config[feature];
  }
};