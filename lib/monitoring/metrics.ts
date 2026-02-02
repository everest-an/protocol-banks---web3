import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from "prom-client"

// Create a custom registry
export const register = new Registry()

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register })

// ============================================================
// HTTP Request Metrics
// ============================================================

/** Counter for total HTTP requests */
export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "path", "status"] as const,
  registers: [register],
})

/** Histogram for HTTP request latency */
export const httpRequestDurationSeconds = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "path", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

// ============================================================
// Payment Metrics
// ============================================================

/** Counter for payment transactions by status */
export const paymentsTotal = new Counter({
  name: "payments_total",
  help: "Total number of payment transactions",
  labelNames: ["type", "status", "currency"] as const,
  registers: [register],
})

/** Histogram for payment amounts */
export const paymentAmountUSD = new Histogram({
  name: "payment_amount_usd",
  help: "Payment amounts in USD equivalent",
  labelNames: ["type", "currency"] as const,
  buckets: [1, 10, 50, 100, 500, 1000, 5000, 10000, 50000],
  registers: [register],
})

// ============================================================
// Batch Payment Metrics
// ============================================================

/** Counter for batch payments */
export const batchPaymentsTotal = new Counter({
  name: "batch_payments_total",
  help: "Total number of batch payment jobs",
  labelNames: ["status"] as const,
  registers: [register],
})

/** Histogram for batch payment throughput (recipients per batch) */
export const batchPaymentThroughput = new Histogram({
  name: "batch_payment_recipients",
  help: "Number of recipients per batch payment",
  labelNames: [] as const,
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
})

// ============================================================
// Authentication Metrics
// ============================================================

/** Counter for authentication events */
export const authEventsTotal = new Counter({
  name: "auth_events_total",
  help: "Total authentication events",
  labelNames: ["event", "provider"] as const,
  registers: [register],
})

// ============================================================
// Database / External Service Metrics
// ============================================================

/** Gauge for active database connections (if applicable) */
export const dbConnectionsActive = new Gauge({
  name: "db_connections_active",
  help: "Number of active database connections",
  registers: [register],
})

/** Histogram for database query latency */
export const dbQueryDurationSeconds = new Histogram({
  name: "db_query_duration_seconds",
  help: "Database query latency in seconds",
  labelNames: ["operation"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [register],
})

// ============================================================
// Blockchain / Web3 Metrics
// ============================================================

/** Counter for blockchain transactions */
export const blockchainTxTotal = new Counter({
  name: "blockchain_tx_total",
  help: "Total blockchain transactions submitted",
  labelNames: ["chain", "status"] as const,
  registers: [register],
})

/** Histogram for gas used in transactions */
export const blockchainGasUsed = new Histogram({
  name: "blockchain_gas_used",
  help: "Gas used per blockchain transaction",
  labelNames: ["chain"] as const,
  buckets: [21000, 50000, 100000, 250000, 500000, 1000000, 2500000],
  registers: [register],
})

// ============================================================
// Helper to record HTTP request metrics (use in middleware)
// ============================================================
export function recordHttpRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number
) {
  httpRequestsTotal.inc({ method, path, status: String(status) })
  httpRequestDurationSeconds.observe(
    { method, path, status: String(status) },
    durationMs / 1000
  )
}
