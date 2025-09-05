import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

interface DatabaseConfig {
  primary: {
    connectionString: string;
    maxConnections: number;
  };
  replicas: Array<{
    connectionString: string;
    maxConnections: number;
    region?: string;
    weight?: number;
  }>;
}

class DatabaseConnectionManager {
  private primaryPool: Pool;
  private replicaPools: Array<{ pool: Pool; region?: string; weight: number }> = [];
  private currentReplicaIndex = 0;
  private totalWeight = 0;

  constructor(config: DatabaseConfig) {
    // Initialize primary connection pool
    this.primaryPool = new Pool({
      connectionString: config.primary.connectionString || process.env.DATABASE_URL,
      max: config.primary.maxConnections || 20,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: false,
      statement_timeout: 30000,
      query_timeout: 30000,
    });

    // Initialize replica pools
    const replicaUrls = this.getReplicaUrls();
    const replicas = replicaUrls.length > 0 ? replicaUrls.map(url => ({
      connectionString: url,
      maxConnections: 15,
      weight: 1
    })) : config.replicas;

    replicas.forEach(replica => {
      const pool = new Pool({
        connectionString: replica.connectionString,
        max: replica.maxConnections || 15,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        allowExitOnIdle: false,
        statement_timeout: 30000,
        query_timeout: 30000,
      });

      const weight = replica.weight || 1;
      this.replicaPools.push({
        pool,
        region: (replica as any).region,
        weight
      });
      this.totalWeight += weight;
    });

    // Set up health checks
    this.setupHealthChecks();
  }

  private getReplicaUrls(): string[] {
    const urls: string[] = [];
    
    // Support multiple read replica URLs from environment
    if (process.env.DATABASE_READ_URL) {
      urls.push(process.env.DATABASE_READ_URL);
    }
    if (process.env.DATABASE_READ_URL_2) {
      urls.push(process.env.DATABASE_READ_URL_2);
    }
    if (process.env.DATABASE_READ_URL_3) {
      urls.push(process.env.DATABASE_READ_URL_3);
    }
    
    return urls;
  }

  private setupHealthChecks() {
    // Check primary health every 30 seconds
    setInterval(async () => {
      try {
        await this.primaryPool.query('SELECT 1');
      } catch (error) {
        console.error('Primary database health check failed:', error);
      }
    }, 30000);

    // Check replica health
    this.replicaPools.forEach((replica, index) => {
      setInterval(async () => {
        try {
          await replica.pool.query('SELECT 1');
        } catch (error) {
          console.error(`Replica ${index} health check failed:`, error);
        }
      }, 30000);
    });
  }

  // Get primary connection for writes
  getPrimary() {
    return drizzle(this.primaryPool);
  }

  // Get replica connection for reads (with load balancing)
  getReplica(region?: string) {
    // If no replicas configured, use primary
    if (this.replicaPools.length === 0) {
      return drizzle(this.primaryPool);
    }

    // Try to find region-specific replica
    if (region) {
      const regionalReplica = this.replicaPools.find(r => r.region === region);
      if (regionalReplica) {
        return drizzle(regionalReplica.pool);
      }
    }

    // Weighted round-robin selection
    const replica = this.selectReplicaByWeight();
    return drizzle(replica.pool);
  }

  private selectReplicaByWeight() {
    // Simple weighted round-robin
    let accumulated = 0;
    const random = Math.random() * this.totalWeight;
    
    for (const replica of this.replicaPools) {
      accumulated += replica.weight;
      if (random < accumulated) {
        return replica;
      }
    }
    
    // Fallback to first replica
    return this.replicaPools[0];
  }

  // Get connection based on operation type
  getConnection(isWrite: boolean = false, region?: string) {
    return isWrite ? this.getPrimary() : this.getReplica(region);
  }

  // Get all pools for monitoring
  getAllPools() {
    return {
      primary: this.primaryPool,
      replicas: this.replicaPools.map(r => r.pool)
    };
  }

  // Graceful shutdown
  async shutdown() {
    await Promise.all([
      this.primaryPool.end(),
      ...this.replicaPools.map(r => r.pool.end())
    ]);
  }

  // Connection statistics
  getStats() {
    return {
      primary: {
        totalCount: this.primaryPool.totalCount,
        idleCount: this.primaryPool.idleCount,
        waitingCount: this.primaryPool.waitingCount
      },
      replicas: this.replicaPools.map((r, i) => ({
        index: i,
        region: r.region,
        totalCount: r.pool.totalCount,
        idleCount: r.pool.idleCount,
        waitingCount: r.pool.waitingCount
      }))
    };
  }
}

// Singleton instance
let dbManager: DatabaseConnectionManager | null = null;

export function initializeDatabaseManager(config?: DatabaseConfig) {
  if (!dbManager) {
    dbManager = new DatabaseConnectionManager(config || {
      primary: {
        connectionString: process.env.DATABASE_URL!,
        maxConnections: parseInt(process.env.DB_PRIMARY_POOL_SIZE || '20')
      },
      replicas: []
    });
  }
  return dbManager;
}

export function getDatabaseManager() {
  if (!dbManager) {
    throw new Error('Database manager not initialized. Call initializeDatabaseManager first.');
  }
  return dbManager;
}

// Helper functions for common patterns
export function dbWrite() {
  return getDatabaseManager().getPrimary();
}

export function dbRead(region?: string) {
  return getDatabaseManager().getReplica(region);
}

export function dbQuery(isWrite: boolean = false, region?: string) {
  return getDatabaseManager().getConnection(isWrite, region);
}