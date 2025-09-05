// CDN and Edge configuration for multi-region support
interface EdgeLocation {
  region: string;
  endpoint: string;
  latency: number;
  priority: number;
}

interface CDNConfig {
  provider: 'cloudflare' | 'fastly' | 'cloudfront' | 'custom';
  regions: EdgeLocation[];
  cacheRules: CacheRule[];
}

interface CacheRule {
  path: string;
  ttl: number;
  bypassCookie?: string;
  varyHeaders?: string[];
  edgeOnly?: boolean;
}

export class EdgeManager {
  private regions: Map<string, EdgeLocation> = new Map();
  private cacheRules: Map<string, CacheRule> = new Map();
  private metrics = {
    hits: 0,
    misses: 0,
    bandwidth: 0,
    requests: new Map<string, number>()
  };

  constructor(private config: CDNConfig) {
    this.initializeRegions();
    this.initializeCacheRules();
  }

  private initializeRegions() {
    this.config.regions.forEach(region => {
      this.regions.set(region.region, region);
    });
  }

  private initializeCacheRules() {
    this.config.cacheRules.forEach(rule => {
      this.cacheRules.set(rule.path, rule);
    });
  }

  // Get nearest edge location based on client location
  getNearestEdge(clientRegion: string): EdgeLocation | null {
    // First try exact match
    if (this.regions.has(clientRegion)) {
      return this.regions.get(clientRegion)!;
    }
    
    // Find closest region based on priority
    let nearest: EdgeLocation | null = null;
    let lowestLatency = Infinity;
    
    this.regions.forEach(region => {
      if (region.latency < lowestLatency) {
        lowestLatency = region.latency;
        nearest = region;
      }
    });
    
    return nearest;
  }

  // Generate CDN headers for response
  getCDNHeaders(path: string, region?: string): Record<string, string> {
    const rule = this.matchCacheRule(path);
    const headers: Record<string, string> = {};
    
    if (rule) {
      // Cache-Control header
      headers['Cache-Control'] = `public, max-age=${rule.ttl}, s-maxage=${rule.ttl}`;
      
      // Vary headers for cache key
      if (rule.varyHeaders?.length) {
        headers['Vary'] = rule.varyHeaders.join(', ');
      }
      
      // Edge caching hints
      if (rule.edgeOnly) {
        headers['CDN-Cache-Control'] = `max-age=${rule.ttl}`;
      }
      
      // Add edge location header
      if (region) {
        headers['X-Edge-Location'] = region;
      }
      
      // Surrogate keys for cache invalidation
      headers['Surrogate-Key'] = this.generateSurrogateKey(path);
    } else {
      // Default no-cache for dynamic content
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Expires'] = '0';
    }
    
    // CORS headers for CDN
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Max-Age'] = '86400';
    
    return headers;
  }

  private matchCacheRule(path: string): CacheRule | null {
    // Exact match first
    if (this.cacheRules.has(path)) {
      return this.cacheRules.get(path)!;
    }
    
    // Pattern matching
    for (const [pattern, rule] of Array.from(this.cacheRules)) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      if (regex.test(path)) {
        return rule;
      }
    }
    
    return null;
  }

  private generateSurrogateKey(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const keys: string[] = [];
    
    // Generate hierarchical keys
    for (let i = 0; i < parts.length; i++) {
      keys.push(parts.slice(0, i + 1).join('-'));
    }
    
    return keys.join(' ');
  }

  // Purge cache for specific paths
  async purgeCache(paths: string[]): Promise<void> {
    const surrogateKeys = paths.map(path => this.generateSurrogateKey(path));
    
    // Implementation would call CDN API to purge by surrogate keys
    console.log('Purging cache for keys:', surrogateKeys);
    
    // In real implementation, this would call:
    // - Cloudflare: Purge by URL or Cache-Tag
    // - Fastly: Purge by Surrogate-Key
    // - CloudFront: CreateInvalidation
  }

  // Track metrics
  recordHit(path: string, region: string) {
    this.metrics.hits++;
    this.updateRequestCount(region);
  }

  recordMiss(path: string, region: string) {
    this.metrics.misses++;
    this.updateRequestCount(region);
  }

  recordBandwidth(bytes: number) {
    this.metrics.bandwidth += bytes;
  }

  private updateRequestCount(region: string) {
    const current = this.metrics.requests.get(region) || 0;
    this.metrics.requests.set(region, current + 1);
  }

  getMetrics() {
    return {
      ...this.metrics,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0,
      requestsByRegion: Object.fromEntries(this.metrics.requests)
    };
  }
}

// Default CDN configuration
export const defaultCDNConfig: CDNConfig = {
  provider: 'cloudflare',
  regions: [
    { region: 'us-east-1', endpoint: 'https://us-east-1.cdn.example.com', latency: 10, priority: 1 },
    { region: 'us-west-1', endpoint: 'https://us-west-1.cdn.example.com', latency: 15, priority: 2 },
    { region: 'eu-west-1', endpoint: 'https://eu-west-1.cdn.example.com', latency: 25, priority: 3 },
    { region: 'ap-southeast-1', endpoint: 'https://ap-southeast-1.cdn.example.com', latency: 35, priority: 4 },
  ],
  cacheRules: [
    // Static assets
    { path: '/static/*', ttl: 31536000, edgeOnly: true }, // 1 year
    { path: '/assets/*', ttl: 31536000, edgeOnly: true },
    { path: '*.css', ttl: 86400, varyHeaders: ['Accept-Encoding'] }, // 1 day
    { path: '*.js', ttl: 86400, varyHeaders: ['Accept-Encoding'] },
    { path: '*.jpg', ttl: 604800, edgeOnly: true }, // 1 week
    { path: '*.png', ttl: 604800, edgeOnly: true },
    { path: '*.svg', ttl: 604800, edgeOnly: true },
    
    // API responses
    { path: '/api/agents', ttl: 60, varyHeaders: ['Authorization', 'X-Organization-Id'] },
    { path: '/api/analytics/*', ttl: 300, varyHeaders: ['Authorization', 'X-Organization-Id'] },
    { path: '/api/call-logs', ttl: 30, varyHeaders: ['Authorization', 'X-Organization-Id', 'X-Page'] },
    
    // HTML pages
    { path: '/', ttl: 300, varyHeaders: ['Accept-Encoding', 'Accept-Language'] },
    { path: '/dashboard', ttl: 0 }, // No cache for dynamic content
  ]
};

// Region detection middleware
export function detectRegion(req: any): string {
  // Check CloudFlare headers
  if (req.headers['cf-ipcountry']) {
    return mapCountryToRegion(req.headers['cf-ipcountry']);
  }
  
  // Check CloudFront headers
  if (req.headers['cloudfront-viewer-country']) {
    return mapCountryToRegion(req.headers['cloudfront-viewer-country']);
  }
  
  // Check custom header
  if (req.headers['x-client-region']) {
    return req.headers['x-client-region'];
  }
  
  // Default to US East
  return 'us-east-1';
}

function mapCountryToRegion(country: string): string {
  const regionMap: Record<string, string> = {
    'US': 'us-east-1',
    'CA': 'us-east-1',
    'MX': 'us-west-1',
    'GB': 'eu-west-1',
    'FR': 'eu-west-1',
    'DE': 'eu-west-1',
    'JP': 'ap-northeast-1',
    'CN': 'ap-southeast-1',
    'AU': 'ap-southeast-2',
    'IN': 'ap-south-1',
  };
  
  return regionMap[country] || 'us-east-1';
}

// Singleton instance
let edgeManager: EdgeManager | null = null;

export function initializeEdgeManager(config?: CDNConfig) {
  if (!edgeManager) {
    edgeManager = new EdgeManager(config || defaultCDNConfig);
  }
  return edgeManager;
}

export function getEdgeManager() {
  if (!edgeManager) {
    throw new Error('Edge manager not initialized');
  }
  return edgeManager;
}