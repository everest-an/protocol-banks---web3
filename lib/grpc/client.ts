/**
 * gRPC Client for Go Microservices
 *
 * This client provides a unified interface to communicate with Go microservices
 * from Next.js. It handles connection pooling, retries, and error handling.
 */

import { Metadata, type ServiceError } from "@grpc/grpc-js"

// Environment-based configuration
const GRPC_CONFIG = {
  payoutEngine: {
    host: process.env.PAYOUT_ENGINE_HOST || "localhost",
    port: process.env.PAYOUT_ENGINE_PORT || "50051",
  },
  eventIndexer: {
    host: process.env.EVENT_INDEXER_HOST || "localhost",
    port: process.env.EVENT_INDEXER_PORT || "50052",
  },
  webhookHandler: {
    host: process.env.WEBHOOK_HANDLER_HOST || "localhost",
    port: process.env.WEBHOOK_HANDLER_PORT || "8080",
  },
}

// Connection options with keepalive
const GRPC_OPTIONS = {
  "grpc.keepalive_time_ms": 10000,
  "grpc.keepalive_timeout_ms": 5000,
  "grpc.keepalive_permit_without_calls": 1,
  "grpc.http2.max_pings_without_data": 0,
  "grpc.http2.min_time_between_pings_ms": 10000,
  "grpc.http2.min_ping_interval_without_data_ms": 5000,
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 1000,
  backoffMultiplier: 2,
}

/**
 * Base gRPC client with retry logic
 */
class GrpcClientBase {
  protected async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | null = null
    let delay = RETRY_CONFIG.initialDelayMs

    for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        const grpcError = error as ServiceError

        // Don't retry on certain error codes
        const nonRetryableCodes = [
          3, // INVALID_ARGUMENT
          5, // NOT_FOUND
          7, // PERMISSION_DENIED
          16, // UNAUTHENTICATED
        ]

        if (grpcError.code && nonRetryableCodes.includes(grpcError.code)) {
          throw error
        }

        if (attempt < RETRY_CONFIG.maxRetries) {
          console.warn(
            `[gRPC] ${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms`,
            grpcError.message,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs)
        }
      }
    }

    throw lastError
  }

  protected createMetadata(userId?: string, requestId?: string): Metadata {
    const metadata = new Metadata()
    if (userId) metadata.set("x-user-id", userId)
    if (requestId) metadata.set("x-request-id", requestId)
    metadata.set("x-client", "nextjs")
    metadata.set("x-timestamp", Date.now().toString())
    return metadata
  }
}

// =============================================================================
// Payout Types (matching proto definitions)
// =============================================================================

export interface PayoutRecipient {
  address: string
  amount: string
  tokenAddress: string
  chainId: number
  vendorName?: string
  vendorId?: string
}

export interface BatchPayoutRequest {
  batchId: string
  userId: string
  senderAddress: string
  recipients: PayoutRecipient[]
  useMultisig: boolean
  multisigWalletId?: string
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
}

export interface BatchPayoutResponse {
  batchId: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "PARTIAL_FAILURE" | "FAILED"
  totalRecipients: number
  successCount: number
  failureCount: number
  transactions: TransactionResult[]
  estimatedCompletionTime?: string
}

export interface TransactionResult {
  recipientAddress: string
  txHash: string
  status: "PENDING" | "CONFIRMED" | "FAILED"
  gasUsed?: string
  errorMessage?: string
}

export interface PayoutStatusRequest {
  batchId: string
  userId: string
}

// =============================================================================
// Payout Engine Client
// =============================================================================

export class PayoutEngineClient extends GrpcClientBase {
  private address: string

  constructor() {
    super()
    this.address = `${GRPC_CONFIG.payoutEngine.host}:${GRPC_CONFIG.payoutEngine.port}`
  }

  /**
   * Submit a batch payout request
   */
  async submitBatchPayout(request: BatchPayoutRequest): Promise<BatchPayoutResponse> {
    return this.withRetry(async () => {
      const response = await fetch(`http://${this.address}/api/v1/payout/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": request.userId,
          "X-Request-ID": request.batchId,
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Batch payout submission failed")
      }

      return response.json()
    }, "submitBatchPayout")
  }

  /**
   * Get batch payout status
   */
  async getBatchStatus(request: PayoutStatusRequest): Promise<BatchPayoutResponse> {
    return this.withRetry(async () => {
      const response = await fetch(
        `http://${this.address}/api/v1/payout/batch/${request.batchId}?userId=${request.userId}`,
        {
          method: "GET",
          headers: {
            "X-User-ID": request.userId,
          },
        },
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to get batch status")
      }

      return response.json()
    }, "getBatchStatus")
  }

  /**
   * Cancel a pending batch payout
   */
  async cancelBatch(batchId: string, userId: string): Promise<{ success: boolean; message: string }> {
    return this.withRetry(async () => {
      const response = await fetch(`http://${this.address}/api/v1/payout/batch/${batchId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": userId,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to cancel batch")
      }

      return response.json()
    }, "cancelBatch")
  }

  /**
   * Estimate gas for batch payout
   */
  async estimateGas(request: BatchPayoutRequest): Promise<{
    totalGasEstimate: string
    gasPrice: string
    totalCostWei: string
    totalCostUsd: number
  }> {
    return this.withRetry(async () => {
      const response = await fetch(`http://${this.address}/api/v1/payout/estimate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-ID": request.userId,
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to estimate gas")
      }

      return response.json()
    }, "estimateGas")
  }
}

// =============================================================================
// Event Indexer Types
// =============================================================================

export interface TransferEvent {
  txHash: string
  blockNumber: number
  timestamp: number
  from: string
  to: string
  amount: string
  tokenAddress: string
  chainId: number
}

export interface SubscribeEventsRequest {
  userId: string
  addresses: string[]
  chainIds: number[]
  eventTypes: ("TRANSFER_IN" | "TRANSFER_OUT" | "APPROVAL" | "SWAP")[]
}

// =============================================================================
// Event Indexer Client
// =============================================================================

export class EventIndexerClient extends GrpcClientBase {
  private address: string
  private eventSource: EventSource | null = null

  constructor() {
    super()
    this.address = `${GRPC_CONFIG.eventIndexer.host}:${GRPC_CONFIG.eventIndexer.port}`
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(address: string, chainId: number, limit = 50, offset = 0): Promise<TransferEvent[]> {
    return this.withRetry(async () => {
      const params = new URLSearchParams({
        address,
        chainId: chainId.toString(),
        limit: limit.toString(),
        offset: offset.toString(),
      })

      const response = await fetch(`http://${this.address}/api/v1/events/history?${params}`, { method: "GET" })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to get transaction history")
      }

      return response.json()
    }, "getTransactionHistory")
  }

  /**
   * Subscribe to real-time events via Server-Sent Events
   */
  subscribeToEvents(
    request: SubscribeEventsRequest,
    onEvent: (event: TransferEvent) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const params = new URLSearchParams({
      userId: request.userId,
      addresses: request.addresses.join(","),
      chainIds: request.chainIds.join(","),
      eventTypes: request.eventTypes.join(","),
    })

    this.eventSource = new EventSource(`http://${this.address}/api/v1/events/subscribe?${params}`)

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TransferEvent
        onEvent(data)
      } catch (error) {
        console.error("[EventIndexer] Failed to parse event:", error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error("[EventIndexer] SSE error:", error)
      onError?.(new Error("Event stream connection failed"))
    }

    // Return unsubscribe function
    return () => {
      this.eventSource?.close()
      this.eventSource = null
    }
  }

  /**
   * Get pending transactions for monitoring
   */
  async getPendingTransactions(addresses: string[]): Promise<
    {
      address: string
      pendingCount: number
      oldestPendingTimestamp: number
    }[]
  > {
    return this.withRetry(async () => {
      const response = await fetch(`http://${this.address}/api/v1/events/pending`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to get pending transactions")
      }

      return response.json()
    }, "getPendingTransactions")
  }
}

// =============================================================================
// Singleton Instances
// =============================================================================

let payoutEngineClient: PayoutEngineClient | null = null
let eventIndexerClient: EventIndexerClient | null = null

export function getPayoutEngineClient(): PayoutEngineClient {
  if (!payoutEngineClient) {
    payoutEngineClient = new PayoutEngineClient()
  }
  return payoutEngineClient
}

export function getEventIndexerClient(): EventIndexerClient {
  if (!eventIndexerClient) {
    eventIndexerClient = new EventIndexerClient()
  }
  return eventIndexerClient
}

// =============================================================================
// Feature Flag: Use Go Services
// =============================================================================

export function isGoServicesEnabled(): boolean {
  return process.env.ENABLE_GO_SERVICES === "true"
}

/**
 * Wrapper that falls back to TypeScript implementation if Go services are disabled
 */
export async function withGoServicesFallback<T>(
  goOperation: () => Promise<T>,
  tsOperation: () => Promise<T>,
): Promise<T> {
  if (isGoServicesEnabled()) {
    try {
      return await goOperation()
    } catch (error) {
      console.error("[gRPC] Go service failed, falling back to TypeScript:", error)
      return tsOperation()
    }
  }
  return tsOperation()
}
