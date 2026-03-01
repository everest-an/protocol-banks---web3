/**
 * AI Wallet SDK — Sub-Client Classes
 *
 * Each sub-client handles a specific domain of API operations:
 *   - PaymentClient:    Send payments, list history, x402 protocol
 *   - SessionKeyClient: Create/list/revoke session keys
 *   - InvoiceClient:    Create/list invoices for receiving payments
 *   - VendorClient:     Create/list/update vendor contacts
 */

import type {
  PaymentRequest,
  Payment,
  PaymentFilters,
  SessionKeyConfig,
  SessionKey,
  CreateInvoiceParams,
  Invoice,
  CreateVendorParams,
  Vendor,
  x402AuthorizationParams,
  x402Authorization,
  x402VerifyResult,
} from './types'

/** Response from execute_payment (on-chain execution) */
export interface ExecutedPayment {
  status: 'executed' | 'failed'
  tx_hash: string
  from: string
  to: string
  amount: string
  token: string
  network: string
  chain_id: number
  block_number?: string
  gas_used?: string
  message: string
}

/** Authenticated request function provided by the SDK */
type RequestFn = <T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) => Promise<T>

// ─── Payment Client ─────────────────────────────────────────────────

export class PaymentClient {
  constructor(private request: RequestFn) {}

  /** Create a new payment */
  async create(params: PaymentRequest): Promise<Payment> {
    return this.request<Payment>('POST', '/api/payments', params)
  }

  /** Get a payment by ID */
  async get(id: string): Promise<Payment> {
    return this.request<Payment>('GET', `/api/payments/${id}`)
  }

  /** List payments with optional filters */
  async list(filters?: PaymentFilters): Promise<Payment[]> {
    const query = filters ? '?' + toQueryString(filters as unknown as Record<string, unknown>) : ''
    return this.request<Payment[]>('GET', `/api/payments${query}`)
  }

  /**
   * Create AND execute a payment on-chain in one step.
   * Requires the server to have AGENT_EXECUTOR_PRIVATE_KEY configured.
   */
  async execute(params: PaymentRequest): Promise<ExecutedPayment> {
    return this.request<ExecutedPayment>('POST', '/api/payments/execute', {
      to_address: params.to,
      amount: params.amount,
      token: params.token,
      network: params.chain || 'base',
      memo: params.memo,
    })
  }

  /**
   * Estimate gas cost for a transfer
   */
  async estimateGas(params: { network: string; token: string; amount: string; to_address: string }): Promise<unknown> {
    return this.request('POST', '/api/payments/estimate-gas', params)
  }

  /**
   * Create an x402 payment authorization.
   * The AI agent can use this for machine-to-machine micropayments.
   */
  async createAuthorization(params: x402AuthorizationParams): Promise<x402Authorization> {
    return this.request<x402Authorization>('POST', '/api/x402/authorize', params)
  }

  /** Verify an x402 payment by transfer ID and transaction hash */
  async verifyPayment(transferId: string, txHash: string): Promise<x402VerifyResult> {
    return this.request<x402VerifyResult>('POST', '/api/x402/verify', {
      transferId,
      txHash,
    })
  }
}

// ─── Session Key Client ─────────────────────────────────────────────

export class SessionKeyClient {
  constructor(private request: RequestFn) {}

  /** Create a new session key with spending limits */
  async create(config: SessionKeyConfig): Promise<SessionKey> {
    return this.request<SessionKey>('POST', '/api/session-keys', config)
  }

  /** List all session keys for the authenticated wallet */
  async list(): Promise<SessionKey[]> {
    return this.request<SessionKey[]>('GET', '/api/session-keys')
  }

  /** Revoke a session key by ID */
  async revoke(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/session-keys/${id}`)
  }
}

// ─── Invoice Client ─────────────────────────────────────────────────

export class InvoiceClient {
  constructor(private request: RequestFn) {}

  /** Create a new invoice for receiving payments */
  async create(params: CreateInvoiceParams): Promise<Invoice> {
    return this.request<Invoice>('POST', '/api/invoice', params)
  }

  /** Get an invoice by ID */
  async get(id: string): Promise<Invoice> {
    return this.request<Invoice>('GET', `/api/invoice/${id}`)
  }

  /** List invoices for the authenticated wallet */
  async list(filters?: { status?: string; limit?: number; offset?: number }): Promise<Invoice[]> {
    const query = filters ? '?' + toQueryString(filters as unknown as Record<string, unknown>) : ''
    return this.request<Invoice[]>('GET', `/api/invoice${query}`)
  }
}

// ─── Vendor Client ──────────────────────────────────────────────────

export class VendorClient {
  constructor(private request: RequestFn) {}

  /** Create a new vendor/contact */
  async create(params: CreateVendorParams): Promise<Vendor> {
    return this.request<Vendor>('POST', '/api/vendors', params)
  }

  /** Get a vendor by ID */
  async get(id: string): Promise<Vendor> {
    return this.request<Vendor>('GET', `/api/vendors/${id}`)
  }

  /** List all vendors for the authenticated wallet */
  async list(): Promise<Vendor[]> {
    return this.request<Vendor[]>('GET', '/api/vendors')
  }

  /** Update a vendor */
  async update(id: string, params: Partial<CreateVendorParams>): Promise<Vendor> {
    return this.request<Vendor>('PATCH', `/api/vendors/${id}`, params)
  }

  /** Delete a vendor */
  async delete(id: string): Promise<void> {
    await this.request<void>('DELETE', `/api/vendors/${id}`)
  }
}

// ─── Utilities ──────────────────────────────────────────────────────

/** Convert an object to URL query string (skip undefined values) */
function toQueryString(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}
