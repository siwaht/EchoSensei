import { EventEmitter } from 'events';

interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  endpoint: string;
  health: string;
  region?: string;
  metadata?: Record<string, any>;
  lastHeartbeat: Date;
  capabilities: string[];
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceInstance[]> = new Map();
  private healthChecks: Map<string, ServiceHealth> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    super();
    this.startHealthMonitoring();
  }

  // Register a service instance
  register(service: ServiceInstance) {
    const instances = this.services.get(service.name) || [];
    const existingIndex = instances.findIndex(s => s.id === service.id);
    
    if (existingIndex >= 0) {
      instances[existingIndex] = service;
    } else {
      instances.push(service);
    }
    
    this.services.set(service.name, instances);
    this.emit('service:registered', service);
    
    // Initialize circuit breaker for this service
    if (!this.circuitBreakers.has(service.name)) {
      this.circuitBreakers.set(service.name, new CircuitBreaker(service.name));
    }
  }

  // Deregister a service instance
  deregister(serviceId: string) {
    for (const [name, instances] of Array.from(this.services.entries())) {
      const filtered = instances.filter((s: any) => s.id !== serviceId);
      if (filtered.length !== instances.length) {
        this.services.set(name, filtered);
        this.emit('service:deregistered', { name, id: serviceId });
        break;
      }
    }
  }

  // Get service instances with load balancing
  getService(name: string, options?: {
    region?: string;
    version?: string;
    strategy?: 'round-robin' | 'least-connections' | 'random';
  }): ServiceInstance | null {
    let instances = this.services.get(name) || [];
    
    // Filter by region if specified
    if (options?.region) {
      instances = instances.filter(s => s.region === options.region);
    }
    
    // Filter by version if specified
    if (options?.version) {
      instances = instances.filter(s => s.version === options.version);
    }
    
    // Filter healthy instances only
    instances = instances.filter(s => {
      const health = this.healthChecks.get(s.id);
      return !health || health.status !== 'unhealthy';
    });
    
    if (instances.length === 0) return null;
    
    // Load balancing strategy
    const strategy = options?.strategy || 'round-robin';
    return this.selectInstance(instances, strategy);
  }

  private selectInstance(instances: ServiceInstance[], strategy: string): ServiceInstance {
    switch (strategy) {
      case 'random':
        return instances[Math.floor(Math.random() * instances.length)];
      
      case 'least-connections':
        // Would need connection tracking implementation
        return instances[0];
      
      case 'round-robin':
      default:
        // Simple round-robin using instance array rotation
        const instance = instances[0];
        instances.push(instances.shift()!);
        return instance;
    }
  }

  // Get all services
  getAllServices(): Map<string, ServiceInstance[]> {
    return new Map(this.services);
  }

  // Health monitoring
  private startHealthMonitoring() {
    setInterval(async () => {
      for (const [name, instances] of Array.from(this.services.entries())) {
        for (const instance of instances) {
          await this.checkHealth(instance);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private async checkHealth(instance: ServiceInstance) {
    try {
      const start = Date.now();
      const response = await fetch(`${instance.endpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const latency = Date.now() - start;
      const status = response.ok ? 'healthy' : 'degraded';
      
      this.healthChecks.set(instance.id, {
        status: status as any,
        latency,
        errorRate: 0,
        lastCheck: new Date()
      });
    } catch (error) {
      this.healthChecks.set(instance.id, {
        status: 'unhealthy',
        latency: 0,
        errorRate: 1,
        lastCheck: new Date()
      });
    }
  }

  // Get service health
  getHealth(serviceId: string): ServiceHealth | undefined {
    return this.healthChecks.get(serviceId);
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure?: Date;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute
  private readonly successThreshold = 3;

  constructor(private serviceName: string) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - (this.lastFailure?.getTime() || 0) > this.timeout) {
        this.state = 'half-open';
        this.successes = 0;
      } else {
        throw new Error(`Circuit breaker is open for service: ${this.serviceName}`);
      }
    }

    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.successes++;
        if (this.successes >= this.successThreshold) {
          this.state = 'closed';
          this.failures = 0;
        }
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = new Date();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = undefined;
  }
}

// API Gateway with routing
class APIGateway {
  constructor(
    private registry: ServiceRegistry,
    private config: {
      rateLimit?: number;
      timeout?: number;
      retries?: number;
    } = {}
  ) {}

  async route(request: {
    service: string;
    path: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
    region?: string;
  }) {
    const service = this.registry.getService(request.service, {
      region: request.region
    });
    
    if (!service) {
      throw new Error(`Service ${request.service} not found`);
    }
    
    const circuitBreaker = new CircuitBreaker(request.service);
    
    return await circuitBreaker.execute(async () => {
      const retries = this.config.retries || 3;
      let lastError;
      
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(`${service.endpoint}${request.path}`, {
            method: request.method,
            headers: {
              'Content-Type': 'application/json',
              ...request.headers
            },
            body: request.body ? JSON.stringify(request.body) : undefined,
            signal: AbortSignal.timeout(this.config.timeout || 30000)
          });
          
          if (!response.ok && i < retries - 1) {
            // Retry on server errors
            if (response.status >= 500) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
              continue;
            }
          }
          
          return response;
        } catch (error) {
          lastError = error;
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
          }
        }
      }
      
      throw lastError;
    });
  }
}

// Singleton instances
let registry: ServiceRegistry | null = null;
let gateway: APIGateway | null = null;

export function initializeServiceRegistry() {
  if (!registry) {
    registry = new ServiceRegistry();
  }
  return registry;
}

export function getServiceRegistry() {
  if (!registry) {
    throw new Error('Service registry not initialized');
  }
  return registry;
}

export function initializeAPIGateway(config?: any) {
  if (!gateway) {
    gateway = new APIGateway(getServiceRegistry(), config);
  }
  return gateway;
}

export function getAPIGateway() {
  if (!gateway) {
    throw new Error('API gateway not initialized');
  }
  return gateway;
}

export { ServiceRegistry, APIGateway, CircuitBreaker };