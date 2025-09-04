import { eq, and, desc, count, sum, avg, sql, or, inArray, gte, lte } from "drizzle-orm";
import { dbWrite, dbRead } from "./db-replicas";
import { getCacheManager, cacheable } from "./cache/cache-manager";
import {
  users,
  organizations,
  integrations,
  agents,
  callLogs,
  type User,
  type Organization,
  type Integration,
  type Agent,
  type CallLog,
} from "@shared/schema";

// Enhanced storage class with read replica and caching support
export class OptimizedStorage {
  private cache = getCacheManager();
  
  // User operations with caching
  @cacheable({ namespace: 'users', ttl: 60000 })
  async getUser(id: string, region?: string): Promise<User | undefined> {
    const [user] = await dbRead(region)
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return user;
  }

  @cacheable({ namespace: 'users', ttl: 60000 })
  async getUserByEmail(email: string, region?: string): Promise<User | undefined> {
    const [user] = await dbRead(region)
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    
    return user;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const [user] = await dbWrite()
      .insert(users)
      .values(userData)
      .returning();
    
    // Invalidate user cache
    await this.cache.getCache('users').clear(`*${user.id}*`);
    await this.cache.getCache('users').clear(`*${user.email}*`);
    
    return user;
  }

  // Organization operations with intelligent caching
  @cacheable({ namespace: 'organizations', ttl: 300000 })
  async getOrganization(id: string, region?: string): Promise<Organization | undefined> {
    const [org] = await dbRead(region)
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    
    return org;
  }

  // Integration operations
  @cacheable({ namespace: 'integrations', ttl: 120000 })
  async getIntegration(
    organizationId: string, 
    provider: string,
    region?: string
  ): Promise<Integration | undefined> {
    const [integration] = await dbRead(region)
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, organizationId),
          eq(integrations.provider, provider)
        )
      )
      .limit(1);
    
    return integration;
  }

  // Agent operations with batch loading
  async getAgents(organizationId: string, region?: string): Promise<Agent[]> {
    const cacheKey = `agents:${organizationId}`;
    
    return this.cache.memoize(
      cacheKey,
      async () => {
        return await dbRead(region)
          .select()
          .from(agents)
          .where(eq(agents.organizationId, organizationId))
          .orderBy(desc(agents.createdAt));
      },
      { namespace: 'agents', ttl: 60000 }
    );
  }

  // Optimized call logs with pagination and caching
  async getCallLogs(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      agentId?: string;
      startDate?: Date;
      endDate?: Date;
      region?: string;
    } = {}
  ): Promise<{ data: CallLog[]; total: number; cached: boolean }> {
    const { limit = 20, offset = 0, agentId, startDate, endDate, region } = options;
    
    // Create cache key from parameters
    const cacheKey = this.cache.createKey({
      organizationId,
      limit,
      offset,
      agentId,
      startDate: startDate?.toISOString(),
      endDate: endDate?.toISOString()
    });
    
    // Try cache first for paginated results
    const cached = await this.cache.getCache('callLogs').get(cacheKey);
    if (cached) {
      return { ...cached as any, cached: true };
    }
    
    // Build query conditions
    const conditions = [eq(callLogs.organizationId, organizationId)];
    if (agentId) {
      conditions.push(eq(callLogs.agentId, agentId));
    }
    if (startDate) {
      conditions.push(gte(callLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(callLogs.createdAt, endDate));
    }
    
    // Execute queries in parallel
    const [dataPromise, countPromise] = await Promise.all([
      dbRead(region)
        .select()
        .from(callLogs)
        .where(and(...conditions))
        .orderBy(desc(callLogs.createdAt))
        .limit(limit)
        .offset(offset),
      
      dbRead(region)
        .select({ count: count() })
        .from(callLogs)
        .where(and(...conditions))
    ]);
    
    const result = {
      data: dataPromise,
      total: countPromise[0]?.count || 0,
      cached: false
    };
    
    // Cache the result
    await this.cache.getCache('callLogs').set(cacheKey, result, { ttl: 30000 });
    
    return result;
  }

  // Analytics with aggressive caching
  @cacheable({ namespace: 'analytics', ttl: 300000 })
  async getAnalytics(
    organizationId: string,
    options: {
      period?: 'day' | 'week' | 'month' | 'year';
      agentId?: string;
      region?: string;
    } = {}
  ): Promise<any> {
    const { period = 'month', agentId, region } = options;
    
    // Calculate date range
    const now = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    const conditions = [
      eq(callLogs.organizationId, organizationId),
      gte(callLogs.createdAt, startDate)
    ];
    
    if (agentId) {
      conditions.push(eq(callLogs.agentId, agentId));
    }
    
    // Run analytics queries in parallel
    const [
      totalCalls,
      totalDuration,
      totalCost,
      uniqueAgents,
      avgDuration,
      successRate
    ] = await Promise.all([
      dbRead(region)
        .select({ count: count() })
        .from(callLogs)
        .where(and(...conditions)),
      
      dbRead(region)
        .select({ sum: sum(callLogs.duration) })
        .from(callLogs)
        .where(and(...conditions)),
      
      dbRead(region)
        .select({ sum: sum(callLogs.cost) })
        .from(callLogs)
        .where(and(...conditions)),
      
      dbRead(region)
        .select({ count: sql<number>`COUNT(DISTINCT ${callLogs.agentId})` })
        .from(callLogs)
        .where(and(...conditions)),
      
      dbRead(region)
        .select({ avg: avg(callLogs.duration) })
        .from(callLogs)
        .where(and(...conditions)),
      
      dbRead(region)
        .select({
          total: count(),
          completed: sql<number>`COUNT(*) FILTER (WHERE ${callLogs.status} = 'completed')`
        })
        .from(callLogs)
        .where(and(...conditions))
    ]);
    
    return {
      period,
      startDate,
      endDate: now,
      metrics: {
        totalCalls: totalCalls[0]?.count || 0,
        totalDuration: Math.round(Number(totalDuration[0]?.sum || 0) / 60),
        totalCost: Number(totalCost[0]?.sum || 0).toFixed(2),
        uniqueAgents: uniqueAgents[0]?.count || 0,
        avgDuration: Math.round(Number(avgDuration[0]?.avg || 0)),
        successRate: successRate[0]?.total 
          ? (successRate[0].completed / successRate[0].total * 100).toFixed(1)
          : 0
      }
    };
  }

  // Batch operations for improved performance
  async batchGetUsers(userIds: string[], region?: string): Promise<User[]> {
    if (userIds.length === 0) return [];
    
    const cacheKey = `batch:users:${userIds.sort().join(',')}`;
    
    return this.cache.memoize(
      cacheKey,
      async () => {
        return await dbRead(region)
          .select()
          .from(users)
          .where(inArray(users.id, userIds));
      },
      { namespace: 'users', ttl: 60000 }
    );
  }

  async batchGetAgents(agentIds: string[], region?: string): Promise<Agent[]> {
    if (agentIds.length === 0) return [];
    
    const cacheKey = `batch:agents:${agentIds.sort().join(',')}`;
    
    return this.cache.memoize(
      cacheKey,
      async () => {
        return await dbRead(region)
          .select()
          .from(agents)
          .where(inArray(agents.id, agentIds));
      },
      { namespace: 'agents', ttl: 60000 }
    );
  }

  // Write operations (always go to primary)
  async createCallLog(data: any): Promise<CallLog> {
    const [callLog] = await dbWrite()
      .insert(callLogs)
      .values(data)
      .returning();
    
    // Invalidate related caches
    await Promise.all([
      this.cache.getCache('callLogs').clear(`*${data.organizationId}*`),
      this.cache.getCache('analytics').clear(`*${data.organizationId}*`)
    ]);
    
    return callLog;
  }

  async updateAgent(id: string, data: Partial<Agent>): Promise<Agent> {
    const [updated] = await dbWrite()
      .update(agents)
      .set(data)
      .where(eq(agents.id, id))
      .returning();
    
    // Invalidate agent caches
    await this.cache.getCache('agents').clear(`*${updated.organizationId}*`);
    
    return updated;
  }

  // Cache warming for frequently accessed data
  async warmCache(organizationId: string, region?: string) {
    await Promise.all([
      this.getOrganization(organizationId, region),
      this.getAgents(organizationId, region),
      this.getAnalytics(organizationId, { region }),
      this.getCallLogs(organizationId, { limit: 20, region })
    ]);
  }

  // Get cache statistics
  getCacheStats() {
    return this.cache.getAllStats();
  }

  // Clear all caches for an organization
  async invalidateOrganizationCache(organizationId: string) {
    await this.cache.invalidate([
      { namespace: 'organizations', pattern: `*${organizationId}*` },
      { namespace: 'agents', pattern: `*${organizationId}*` },
      { namespace: 'callLogs', pattern: `*${organizationId}*` },
      { namespace: 'analytics', pattern: `*${organizationId}*` },
      { namespace: 'integrations', pattern: `*${organizationId}*` }
    ]);
  }
}

// Export singleton instance
let optimizedStorage: OptimizedStorage | null = null;

export function getOptimizedStorage() {
  if (!optimizedStorage) {
    optimizedStorage = new OptimizedStorage();
  }
  return optimizedStorage;
}