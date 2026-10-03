/**
 * Go Services Bridge (gRPC)
 * Routes requests to Go microservices via gRPC with fallback to TypeScript implementation
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { createPublicClient, createWalletClient, http, parseAbi, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, polygon, base, arbitrum, optimism, bsc, sepolia, type Chain } from 'viem/chains';
import { getCircuitBreaker, CircuitBreakerOpenError } from './circuit-breaker';
import { HealthMonitorService } from './health-monitor-service';
import { ERC3009_TOKENS, TRANSFER_WITH_AUTHORIZATION_ABI } from '../erc3009';
import { EVM_NETWORKS } from '../networks';

/**
 * Serialize relayer transactions per chain+address and assign explicit,
 * locally-incrementing nonces.
 *
 * Batch items are submitted back to back from one relayer account. Two races
 * showed up in the E2E run: concurrent sends fetched the same pending nonce
 * ("replacement transaction underpriced"), and even after broadcast
 * serialization the shared public RPC sometimes lagged the mempool and handed
 * out a stale pending nonce. Both disappear when the queue owns the nonce:
 * each send gets the next explicit value, and only a failure re-syncs from the
 * chain. On-chain reverts still consume their nonce, so the counter advances
 * in the success and revert cases alike.
 *
 * Scoped per serverless instance; the Go payout service keeps its own
 * distributed nonce locking on the path used in production.
 */
type RelayerSendQueue = { tail: Promise<unknown>; nextNonce?: number };
const relayerSendQueues = new Map<string, RelayerSendQueue>();

function enqueueRelayerSend<T>(
  key: string,
  fetchNonce: () => Promise<number>,
  send: (nonce: number) => Promise<T>,
): Promise<T> {
  const queue = relayerSendQueues.get(key) ?? { tail: Promise.resolve() };
  const run = async (): Promise<T> => {
    const nonce = queue.nextNonce ?? (await fetchNonce());
    try {
      const result = await send(nonce);
      queue.nextNonce = nonce + 1;
      return result;
    } catch (error) {
      // After any failure the chain is the source of truth again.
      queue.nextNonce = undefined;
      throw error;
    }
  };
  const next = queue.tail.catch(() => {}).then(run);
  queue.tail = next;
  relayerSendQueues.set(key, queue);
  return next;
}

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
  /**
   * EIP-3009 authorization signed by `from_address`.
   *
   * Present → the transfer goes through `transferWithAuthorization`: the funds
   * leave the signer's own balance and the relayer only submits and pays gas
   * (non-custodial). Absent → the legacy path pays from the relayer's balance.
   */
  authorization?: {
    validAfter: number;
    validBefore: number;
    nonce: string; // bytes32
    v: number;
    r: string;
    s: string;
  };
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

// ============================================
// Chain & Token Configuration
// ============================================

const CHAIN_BY_ID: Record<number, Chain> = {
  1: mainnet,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
  56: bsc,
  11155111: sepolia,
}

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
])

// ============================================
// Go Service Config
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

    // The Go payout-engine predates EIP-3009: its proto has no authorization
    // field, so it would execute a custodial transfer from the relayer's own
    // balance even when the caller supplied a signed authorization — the
    // non-custodial guarantee would be dropped silently. Route those to the
    // TypeScript path, which implements transferWithAuthorization.
    if (request.authorization) {
      return await this.executePayoutTypescript(request);
    }

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
   * TypeScript fallback implementation for payout.
   * Uses RELAYER_PRIVATE_KEY to sign and broadcast an ERC-20 transfer on-chain.
   * Requires the relayer wallet to hold the token balance.
   */
  private async executePayoutTypescript(request: PayoutRequest): Promise<PayoutResponse> {
    console.log('[GoServicesBridge] Executing payout via TypeScript fallback:', request);

    const privateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!privateKey) {
      console.warn('[GoServicesBridge] RELAYER_PRIVATE_KEY not set; TypeScript fallback unavailable');
      return { success: false, error: 'Relayer not configured (RELAYER_PRIVATE_KEY missing)', executed_by: 'typescript' };
    }

    const chain = CHAIN_BY_ID[request.chain_id];
    if (!chain) {
      return { success: false, error: `Unsupported chain ID: ${request.chain_id}`, executed_by: 'typescript' };
    }

    const tokenInfo = ERC3009_TOKENS[request.chain_id]?.[request.token.toUpperCase()];
    if (!tokenInfo) {
      return { success: false, error: `Token ${request.token} not found on chain ${request.chain_id}`, executed_by: 'typescript' };
    }

    try {
      const account = privateKeyToAccount(privateKey as `0x${string}`);
      // Use the app's own RPC configuration instead of viem's public default:
      // the default endpoint for sepolia (drpc.org) answers 400, while
      // EVM_NETWORKS already carries a working URL per chain.
      const rpcUrl = Object.values(EVM_NETWORKS).find((n) => n.chainId === request.chain_id)?.rpcUrl
      const transport = rpcUrl ? http(rpcUrl) : http()
      const walletClient = createWalletClient({ account, chain, transport });
      const publicClient = createPublicClient({ chain, transport });

      const amountInUnits = parseUnits(request.amount, tokenInfo.decimals);

      // Nonces are per-chain, so the queue key must include the chain.
      const sendKey = `${account.address}:${request.chain_id}`;

      let txHash: `0x${string}`;
      if (request.authorization) {
        // Non-custodial: the signer's own balance funds the transfer; the
        // relayer only submits the authorization and pays gas.
        const { validAfter, validBefore, nonce, v, r, s } = request.authorization;
        txHash = await enqueueRelayerSend(
          sendKey,
          () => publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
          (txNonce) =>
            walletClient.writeContract({
              address: tokenInfo.address as `0x${string}`,
              abi: TRANSFER_WITH_AUTHORIZATION_ABI,
              functionName: 'transferWithAuthorization',
              args: [
                request.from_address as `0x${string}`,
                request.to_address as `0x${string}`,
                amountInUnits,
                BigInt(validAfter),
                BigInt(validBefore),
                nonce as `0x${string}`,
                v,
                r as `0x${string}`,
                s as `0x${string}`,
              ],
              nonce: txNonce,
            })
        );
      } else {
        // Legacy custodial path: the relayer pays from its own balance.
        txHash = await enqueueRelayerSend(
          sendKey,
          () => publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
          (txNonce) =>
            walletClient.writeContract({
              address: tokenInfo.address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: 'transfer',
              args: [request.to_address as `0x${string}`, amountInUnits],
              nonce: txNonce,
            })
        );
      }

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      console.log('[GoServicesBridge] TypeScript fallback tx confirmed:', txHash);
      return { success: true, tx_hash: txHash, executed_by: 'typescript' };
    } catch (error: any) {
      console.error('[GoServicesBridge] TypeScript fallback tx failed:', error.message);
      return { success: false, error: error.message || 'Transaction failed', executed_by: 'typescript' };
    }
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
