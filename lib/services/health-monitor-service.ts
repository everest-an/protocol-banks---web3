/**
 * Health Monitor Service
 * Monitors system health including database and Go services
 */

import { createClient } from '@/lib/supabase-client';

// ============================================
// Types
// ============================================

export type ServiceStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ComponentHealth {
  name: string;
  status: ServiceStatus;
  latency_ms?: number;
  message?: string;
  last_check?: string;
}

export interface HealthCheckResult {
  status: ServiceStatus;
  timestamp: string;
  version: string;
  uptime_seconds: number;
  components: ComponentHealth[];
}

export interface BasicHealthResult {
  status: 'ok' | 'error';
  timestamp: string;
}

// ============================================
// Constants
// ============================================

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const APP_START_TIME = Date.now();

// Go service endpoints (configurable via env)
const GO_SERVICES = {
  'payout-engine': process.env.PAYOUT_ENGINE_URL || 'http://localhost:8081',
  'event-indexer': process.env.EVENT_INDEXER_URL || 'http://localhost:8082',
  'webhook-handler': process.env.WEBHOOK_HANDLER_URL || 'http://localhost:8083',
};

// ============================================
// Health Monitor Service
// ============================================

export class HealthMonitorService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Basic health check - just returns ok if service is running
   */
  async basicHealth(): Promise<BasicHealthResult> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed health check with all components
   */
  async detailedHealth(): Promise<HealthCheckResult> {
    const components: ComponentHealth[] = [];
    
    // Check database
    const dbHealth = await this.checkDatabase();
    components.push(dbHealth);

    // Check Go services
    for (const [name, url] of Object.entries(GO_SERVICES)) {
      const serviceHealth = await this.checkGoService(name, url);
      components.push(serviceHealth);
    }

    // Determine overall status
    const overallStatus = this.calculateOverallStatus(components);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime_seconds: Math.floor((Date.now() - APP_START_TIME) / 1000),
      components,
    };
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      // Simple query to check connectivity
      const { error } = await this.supabase
        .from('api_keys')
        .select('id')
        .limit(1);

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          latency_ms: latency,
          message: error.message,
          last_check: new Date().toISOString(),
        };
      }

      return {
        name: 'database',
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency_ms: latency,
        message: latency < 1000 ? 'Connected' : 'Slow response',
        last_check: new Date().toISOString(),
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        return {
          name: 'database',
          status: 'unhealthy',
          latency_ms: HEALTH_CHECK_TIMEOUT_MS,
          message: 'Connection timeout',
          last_check: new Date().toISOString(),
        };
      }

      return {
        name: 'database',
        status: 'unhealthy',
        latency_ms: latency,
        message: error.message || 'Connection failed',
        last_check: new Date().toISOString(),
      };
    }
  }

  /**
   * Check Go service health
   */
  async checkGoService(name: string, baseUrl: string): Promise<ComponentHealth> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          name,
          status: latency < 1000 ? 'healthy' : 'degraded',
          latency_ms: latency,
          message: 'Service available',
          last_check: new Date().toISOString(),
        };
      }

      return {
        name,
        status: 'unhealthy',
        latency_ms: latency,
        message: `HTTP ${response.status}`,
        last_check: new Date().toISOString(),
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      if (error.name === 'AbortError') {
        return {
          name,
          status: 'unhealthy',
          latency_ms: HEALTH_CHECK_TIMEOUT_MS,
          message: 'Connection timeout',
          last_check: new Date().toISOString(),
        };
      }

      // Service not available - this is expected in dev
      return {
        name,
        status: 'unknown',
        latency_ms: latency,
        message: 'Service not available',
        last_check: new Date().toISOString(),
      };
    }
  }

  /**
   * Calculate overall status from component statuses
   */
  private calculateOverallStatus(components: ComponentHealth[]): ServiceStatus {
    const statuses = components.map(c => c.status);
    
    // If any critical component (database) is unhealthy, overall is unhealthy
    const dbStatus = components.find(c => c.name === 'database')?.status;
    if (dbStatus === 'unhealthy') {
      return 'unhealthy';
    }

    // If database is degraded, overall is degraded
    if (dbStatus === 'degraded') {
      return 'degraded';
    }

    // If all Go services are unhealthy, overall is degraded (not unhealthy, since TS fallback exists)
    const goServices = components.filter(c => c.name !== 'database');
    const allGoUnhealthy = goServices.every(s => s.status === 'unhealthy' || s.status === 'unknown');
    if (allGoUnhealthy && goServices.length > 0) {
      return 'degraded';
    }

    // If any component is degraded, overall is degraded
    if (statuses.includes('degraded')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Check if a specific Go service is available
   */
  async isGoServiceAvailable(serviceName: keyof typeof GO_SERVICES): Promise<boolean> {
    const url = GO_SERVICES[serviceName];
    if (!url) return false;

    const health = await this.checkGoService(serviceName, url);
    return health.status === 'healthy' || health.status === 'degraded';
  }
}

// Export singleton instance
export const healthMonitorService = new HealthMonitorService();
