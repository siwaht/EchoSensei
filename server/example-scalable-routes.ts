import { Router } from 'express';
import { getOptimizedStorage } from './storage-optimized';
import { getCacheManager } from './cache/cache-manager';
import { getEdgeManager, detectRegion } from './cdn/edge-config';
import { getPerformanceMonitor } from './monitoring/performance-monitor';
import { ScalabilityHelpers } from './scalability-config';

// Example of scalable route implementation
const router = Router();
const storage = getOptimizedStorage();

// Example 1: Optimized call logs endpoint with caching and read replicas
router.get('/api/v2/call-logs', async (req: any, res) => {
  try {
    // Detect client region for optimal routing
    const region = detectRegion(req);
    
    // Extract parameters
    const { page = 1, limit = 20, agentId, startDate, endDate } = req.query;
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Calculate offset
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Fetch from optimized storage (uses read replicas and caching)
    const result = await storage.getCallLogs(organizationId, {
      limit: parseInt(limit),
      offset,
      agentId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      region
    });
    
    // Add cache headers if data was cached
    if (result.cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'private, max-age=30');
    } else {
      res.setHeader('X-Cache', 'MISS');
    }
    
    // Add region header
    res.setHeader('X-Region', region);
    
    // Return paginated response
    res.json({
      data: result.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit))
      },
      cached: result.cached
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example 2: Analytics endpoint with heavy caching
router.get('/api/v2/analytics', async (req: any, res) => {
  try {
    const region = detectRegion(req);
    const organizationId = req.user?.organizationId;
    const { period = 'month', agentId } = req.query;
    
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Use cache manager directly for custom caching logic
    const cache = getCacheManager();
    const cacheKey = cache.createKey({
      endpoint: 'analytics',
      organizationId,
      period,
      agentId
    });
    
    // Try to get from cache first
    const cachedData = await cache.getCache('analytics').get(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.json(cachedData);
    }
    
    // Fetch fresh data
    const analytics = await storage.getAnalytics(organizationId, {
      period: period as any,
      agentId,
      region
    });
    
    // Cache the result
    await cache.getCache('analytics').set(cacheKey, analytics, {
      ttl: 300000 // 5 minutes
    });
    
    res.setHeader('X-Cache', 'MISS');
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example 3: Batch endpoint for efficient data loading
router.post('/api/v2/batch', async (req: any, res) => {
  try {
    const region = detectRegion(req);
    const { userIds = [], agentIds = [] } = req.body;
    
    // Use Promise.all for parallel fetching
    const [users, agents] = await Promise.all([
      userIds.length > 0 ? storage.batchGetUsers(userIds, region) : [],
      agentIds.length > 0 ? storage.batchGetAgents(agentIds, region) : []
    ]);
    
    res.json({
      users,
      agents
    });
  } catch (error) {
    console.error('Error in batch operation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example 4: Cache warming endpoint
router.post('/api/v2/cache/warm', async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    const region = detectRegion(req);
    
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Warm cache for organization
    await storage.warmCache(organizationId, region);
    
    res.json({ 
      message: 'Cache warmed successfully',
      organization: organizationId,
      region 
    });
  } catch (error) {
    console.error('Error warming cache:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example 5: Cache invalidation endpoint
router.delete('/api/v2/cache', async (req: any, res) => {
  try {
    const organizationId = req.user?.organizationId;
    
    if (!organizationId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Invalidate all caches for organization
    await storage.invalidateOrganizationCache(organizationId);
    
    res.json({ 
      message: 'Cache invalidated successfully',
      organization: organizationId 
    });
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example 6: Performance metrics endpoint
router.get('/api/v2/performance', async (req: any, res) => {
  try {
    const monitor = getPerformanceMonitor();
    const cacheStats = storage.getCacheStats();
    const metrics = monitor.getPerformanceMetrics();
    
    res.json({
      performance: metrics,
      cache: cacheStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Example 7: Edge purge endpoint
router.post('/api/v2/cdn/purge', async (req: any, res) => {
  try {
    const { paths = [] } = req.body;
    const edgeManager = getEdgeManager();
    
    // Purge CDN cache for specified paths
    await edgeManager.purgeCache(paths);
    
    res.json({ 
      message: 'CDN cache purged successfully',
      paths 
    });
  } catch (error) {
    console.error('Error purging CDN cache:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// Usage example in main server file:
// import scalableRoutes from './example-scalable-routes';
// app.use(scalableRoutes);