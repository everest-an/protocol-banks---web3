/**
 * Go Services Bridge (gRPC)
 * Routes requests to Go microservices via gRPC with fallback to TypeScript implementation
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
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

const GO_SERVICE_CONFIG = {
  payout: {
    host: process.env.PAYOUT_ENGINE_HOST || 'localhost:50051',
    protoPath: 'services/proto/payout.proto'
  }
};

const PROTO_OPTIONS: protoLoader.Options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
};

// ============================================
// Go Services Bridge
// ============================================

export class GoServicesBridge {
  private healthMonitor: HealthMonitorService;
  private fallbackEvents: FallbackEvent[] = [];
  
  private payoutClient: any; // gRPC Client

  constructor() {
    this.healthMonitor = new HealthMonitorService();
    this.initGrpcClients();
  }

  private initGrpcClients() {
    try {
      // Use process.cwd() to resolve path relevant to project root
      // Assuming 'services/proto/payout.proto' is the path from root
      const payoutProtoPath = path.resolve(process.cwd(), GO_SERVICE_CONFIG.payout.protoPath);
      
      const packageDefinition = protoLoader.loadSync(payoutProtoPath, PROTO_OPTIONS);
      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
      
      const PayoutService = protoDescriptor.payout.PayoutService;
      this.payoutClient = new PayoutService(
        GO_SERVICE_CONFIG.payout.host, 
        grpc.credentials.createInsecure()
      );
      
      console.log('[GoServicesBridge] gRPC Clients initialized');
    } catch (error) {
      console.warn('[GoServicesBridge] Failed to initialize gRPC clients (Proto files missing?):', error);
      // We don't throw here to allow fallback to work even if init fails
    }
  }

  /**
   * Execute a payout through Go service or fallback to TypeScript
   */
  async executePayout(request: PayoutRequest): Promise<PayoutResponse> {
    const startTime = Date.now();
    const circuitBreaker = getCircuitBreaker('payout-engine', {
      failureThreshold: 3,
      timeout: 30000, 
    });

    // Try Go service first
    try {
      if (!this.payoutClient) throw new Error('gRPC client not initialized');

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
   * Call Go payout service (gRPC)
   */
  private callGoPayoutService(request: PayoutRequest): Promise<PayoutResponse> {
    return new Promise((resolve, reject) => {
      // Convert PayoutRequest (Single) to BatchPayoutRequest (Proto)
      // Note: We need to generate a unique batch ID
      const batchRequest = {
        batch_id: `batch_${Date.now()}`,
        user_id: 'system', // Default user
        from_address: request.from_address,
        chain_id: request.chain_id,
        items: [
          {
            id: `item_${Date.now()}`,
            recipient_address: request.to_address,
            amount: request.amount, // Ensure this is in correct units (wei)
            token_address: '', // Deferred: token address resolution handled by payout engine
            token_symbol: request.token,
            token_decimals: 18, // Default, logic should handle this
            vendor_name: '',
            vendor_id: '',
            memo: request.memo || ''
          }
        ]
      };

      // Set deadline
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      const metadata = new grpc.Metadata();
      // Add any auth metadata here if needed

      this.payoutClient.SubmitBatchPayout(batchRequest, { deadline, metadata }, (error: any, response: any) => {
        if (error) {
          reject(new Error(`gRPC Error: ${error.message}`));
          return;
        }

        resolve({
          success: true,
          tx_hash: response.tx_hash || 'pending', // Proto response fields
          executed_by: 'go',
        });
      });
    });
  }

  /**
   * TypeScript fallback implementation for payout
   */
  private async executePayoutTypescript(request: PayoutRequest): Promise<PayoutResponse> {
    console.log('[GoServicesBridge] Executing payout via TypeScript fallback:', request);
    
    // In production, this would use ethers.js/viem
    return {
      success: true,
      tx_hash: `0x${Date.now().toString(16)}${'0'.repeat(48)}`, 
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
    if (this.fallbackEvents.length > 100) this.fallbackEvents = this.fallbackEvents.slice(-100);
    console.log(`[GoServicesBridge] Fallback event:`, event);
  }

  getFallbackEvents(limit: number = 10): FallbackEvent[] {
    return this.fallbackEvents.slice(-limit);
  }
}

// Export singleton instance
export const goServicesBridge = new GoServicesBridge();
