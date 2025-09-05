import { EventEmitter } from 'events';

interface MetricPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private responseTimes: number[] = [];
  private requestCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  private startTime = Date.now();
  private maxMetricPoints = 1000; // Keep last 1000 points per metric

  constructor() {
    super();
    this.startCollecting();
  }

  private startCollecting() {
    // Collect system metrics every 10 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);

    // Clean old metrics every minute
    setInterval(() => {
      this.cleanOldMetrics();
    }, 60000);
  }

  private collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    this.recordMetric('memory.rss', memoryUsage.rss);
    this.recordMetric('memory.heapTotal', memoryUsage.heapTotal);
    this.recordMetric('memory.heapUsed', memoryUsage.heapUsed);
    this.recordMetric('memory.external', memoryUsage.external);
    this.recordMetric('cpu.user', cpuUsage.user);
    this.recordMetric('cpu.system', cpuUsage.system);
    
    // Emit metrics event for external monitoring
    this.emit('metrics', {
      memory: memoryUsage,
      cpu: cpuUsage,
      uptime: Date.now() - this.startTime
    });
  }

  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const points = this.metrics.get(name)!;
    points.push({
      timestamp: new Date(),
      value,
      tags
    });
    
    // Keep only recent points
    if (points.length > this.maxMetricPoints) {
      points.shift();
    }
  }

  recordRequest(endpoint: string, responseTime: number, statusCode: number) {
    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 10000) {
      this.responseTimes.shift();
    }
    
    // Track request counts
    const count = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, count + 1);
    
    // Track errors
    if (statusCode >= 400) {
      const errorCount = this.errorCounts.get(endpoint) || 0;
      this.errorCounts.set(endpoint, errorCount + 1);
    }
    
    // Record metrics
    this.recordMetric('request.time', responseTime, { endpoint, status: String(statusCode) });
    this.recordMetric('request.count', 1, { endpoint });
    
    if (statusCode >= 400) {
      this.recordMetric('error.count', 1, { endpoint, status: String(statusCode) });
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const sortedResponseTimes = [...this.responseTimes].sort((a, b) => a - b);
    const totalRequests = Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0);
    
    return {
      requestCount: totalRequests,
      errorCount: totalErrors,
      avgResponseTime: this.calculateAverage(this.responseTimes),
      p95ResponseTime: this.calculatePercentile(sortedResponseTimes, 0.95),
      p99ResponseTime: this.calculatePercentile(sortedResponseTimes, 0.99),
      activeConnections: 0, // Would need to track from server
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)];
  }

  private cleanOldMetrics() {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    
    for (const [name, points] of Array.from(this.metrics)) {
      const filtered = points.filter((p: any) => 
        now - p.timestamp.getTime() < maxAge
      );
      this.metrics.set(name, filtered);
    }
  }

  getMetricHistory(name: string, duration: number = 3600000): MetricPoint[] {
    const points = this.metrics.get(name) || [];
    const cutoff = Date.now() - duration;
    return points.filter(p => p.timestamp.getTime() > cutoff);
  }

  reset() {
    this.metrics.clear();
    this.responseTimes = [];
    this.requestCounts.clear();
    this.errorCounts.clear();
  }
}

// Express middleware for automatic performance monitoring
export function performanceMiddleware(monitor: PerformanceMonitor) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const endpoint = req.route?.path || req.path;
    
    // Track response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const responseTime = Date.now() - start;
      monitor.recordRequest(endpoint, responseTime, res.statusCode);
      originalEnd.apply(res, args);
    };
    
    next();
  };
}

// Health check endpoint data
export function getHealthStatus(monitor: PerformanceMonitor) {
  const metrics = monitor.getPerformanceMetrics();
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  // Determine health status
  let status = 'healthy';
  const checks: Record<string, boolean> = {};
  
  // Memory check (warn if > 80% heap used)
  const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  checks.memory = heapUsedPercent < 80;
  
  // Response time check (warn if p95 > 1000ms)
  checks.responseTime = metrics.p95ResponseTime < 1000;
  
  // Error rate check (warn if > 5%)
  const errorRate = metrics.requestCount > 0 
    ? (metrics.errorCount / metrics.requestCount) * 100 
    : 0;
  checks.errorRate = errorRate < 5;
  
  if (!checks.memory || !checks.responseTime || !checks.errorRate) {
    status = 'degraded';
  }
  
  return {
    status,
    uptime,
    timestamp: new Date().toISOString(),
    metrics: {
      requests: {
        total: metrics.requestCount,
        errors: metrics.errorCount,
        errorRate: `${errorRate.toFixed(2)}%`
      },
      performance: {
        avgResponseTime: `${metrics.avgResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${metrics.p95ResponseTime.toFixed(2)}ms`,
        p99ResponseTime: `${metrics.p99ResponseTime.toFixed(2)}ms`
      },
      system: {
        memory: {
          used: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
          percentage: `${heapUsedPercent.toFixed(2)}%`
        },
        cpu: {
          user: `${(metrics.cpuUsage.user / 1000000).toFixed(2)}s`,
          system: `${(metrics.cpuUsage.system / 1000000).toFixed(2)}s`
        }
      }
    },
    checks
  };
}

// Singleton instance
let monitor: PerformanceMonitor | null = null;

export function initializePerformanceMonitor() {
  if (!monitor) {
    monitor = new PerformanceMonitor();
  }
  return monitor;
}

export function getPerformanceMonitor() {
  if (!monitor) {
    throw new Error('Performance monitor not initialized');
  }
  return monitor;
}

export { PerformanceMonitor };