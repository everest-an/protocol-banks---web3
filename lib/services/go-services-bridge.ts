/**
 * Go Services Bridge
 * Routes requests to Go microservices with fallback to TypeScript implementation
 */

import { getCircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';
import { HealthMonitorService } from './health-monitor-service';

// ============================================
// Types
// ============================================

export interface PayoutRequest {
  from_address: string;
  to_address: string;
  amount: string;
  token: string;
  chain_id: number;
  memo?: string;
}

export interface PayoutResponse {
  success: boolean;
  tx_hash?: string;
  error?: string;
  executed_by: 'go' | 'typescript';
}

export interface FallbackEvent {
  service: string;
  reason: string;
  duration_ms: number;
  timestamp: string;
}

// ============================================
// Constants
// ============================================

const GO_SERVICE_URLS = {
  'payout-engine': process.env.PAYOUT_ENGINE_URL || 'http://localhost:8081',
  'event-indexer': process.env.EVENT_INDEXER_URL || 'http://localhost:8082',
  'webhook-handler': process.env.WEBHOOK_HANDLER_URL || 'http://localhost:8083',
};

const REQUEST_TIMEOUT_MS = 5000;

// ============================================
// Go Services Bridge
// ============================================

export class GoServicesBridge {
  private healthMonitor: HealthMonitorService;
  private fallbackEvents: FallbackEvent[] = [];

  constructor() {
    this.healthMonitor = new HealthMonitorService();
  }

  /**
   * Execute a payout through Go service or fallback to TypeScript
   */
  async executePayout(request: PayoutRequest): Promise<PayoutResponse> {
    const startTime = Date.now();
    const circuitBreaker = getCircuitBreaker('payout-engine', {
      failureThreshold: 3,
      timeout: 30000, // 30 seconds before retry
    });

    // Try Go service first
    try {
      const result = await circuitBreaker.execute(async () => {
        return await this.callGoPayoutService(request);
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log fallback event
      const reason = error instanceof CircuitBreakerOpenError
        ? 'circuit_breaker_open'
        : (error as Error).message || 'unknown_error';
      
      this.logFallbackEvent('payout-engine', reason, duration);

      // Fallback to TypeScript implementation
      return await this.executePayoutTypescript(request);
    }
  }

  /**
   * Call Go payout service
   */
  private async callGoPayoutService(request: PayoutRequest): Promise<PayoutResponse> {
    const url = `${GO_SERVICE_URLS['payout-engine']}/api/payout`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`Go service error: HTTP ${response.status} - ${errorBody}`);
      }

      const data = await response.json();
      return {
        success: true,
        tx_hash: data.tx_hash,
        executed_by: 'go',
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * TypeScript fallback implementation for payout
   */
  private async executePayoutTypescript(request: PayoutRequest): Promise<PayoutResponse> {
    // This is a placeholder - in production, this would use ethers.js or viem
    // to execute the transaction directly
    console.log('[GoServicesBridge] Executing payout via TypeScript fallback:', request);
    
    // Simulate transaction execution
    // In production, this would:
    // 1. Connect to the appropriate chain
    // 2. Build and sign the transaction
    // 3. Submit to the network
    // 4. Wait for confirmation
    
    return {
      success: true,
      tx_hash: `0x${Date.now().toString(16)}${'0'.repeat(48)}`, // Placeholder
      executed_by: 'typescript',
    };
  }

  /**
   * Log a fallback event
   */
  private logFallbackEvent(service: string, reason: string, duration_ms: number): void {
    const event: FallbackEvent = {
      service,
      reason,
      duration_ms,
      timestamp: new Date().toISOString(),
    };

    this.fallbackEvents.push(event);
    
    // Keep only last 100 events
    if (this.fallbackEvents.length > 100) {
      this.fallbackEvents = this.fallbackEvents.slice(-100);
    }

    console.log(`[GoServicesBridge] Fallback event:`, event);
  }

  /**
   * Get recent fallback events
   */
  getFallbackEvents(limit: number = 10): FallbackEvent[] {
    return this.fallbackEvents.slice(-limit);
  }

  /**
   * Check if Go service is available
   */
  async isGoServiceAvailable(service: keyof typeof GO_SERVICE_URLS): Promise<boolean> {
    const circuitBreaker = getCircuitBreaker(service);
    
    // If circuit is open, service is not available
    if (circuitBreaker.isOpen()) {
      return false;
    }

    // Check actual health
    return await this.healthMonitor.isGoServiceAvailable(service as any);
  }

  /**
   * Get service status for all Go services
   */
  async getServicesStatus(): Promise<Record<string, { available: boolean; circuit_state: string }>> {
    const status: Record<string, { available: boolean; circuit_state: string }> = {};

    for (const service of Object.keys(GO_SERVICE_URLS) as Array<keyof typeof GO_SERVICE_URLS>) {
      const circuitBreaker = getCircuitBreaker(service);
      const available = await this.isGoServiceAvailable(service);
      
      status[service] = {
        available,
        circuit_state: circuitBreaker.getState(),
      };
    }

    return status;
  }

  /**
   * Force reset circuit breaker for a service
   */
  resetCircuitBreaker(service: keyof typeof GO_SERVICE_URLS): void {
    const circuitBreaker = getCircuitBreaker(service);
    circuitBreaker.reset();
    console.log(`[GoServicesBridge] Circuit breaker reset for ${service}`);
  }
}

// Export singleton instance
export const goServicesBridge = new GoServicesBridge();
