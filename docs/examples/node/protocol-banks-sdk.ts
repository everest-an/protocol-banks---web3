/**
 * Protocol Banks - Node.js / TypeScript SDK Example
 *
 * Lightweight wrapper around the Protocol Banks REST API.
 * Copy this file into your project or use it as a reference.
 *
 * Requirements: Node 18+ (native fetch) or install node-fetch
 *
 * Usage:
 *   import { ProtocolBanks } from './protocol-banks-sdk'
 *
 *   const pb = new ProtocolBanks({
 *     walletAddress: '0xYourWallet...',
 *     baseUrl: 'https://app.protocolbanks.com/api',
 *   })
 *
 *   const invoice = await pb.invoices.create({ amount: 25, token: 'USDC', ... })
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface PBConfig {
  walletAddress: string
  baseUrl?: string
  apiKey?: string
  timeout?: number
}

export interface Invoice {
  id: string
  invoice_id: string
  amount: number
  token: string
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  recipient_address: string
  payment_url?: string
  expires_at?: string
  created_at: string
}

export interface CreateInvoiceParams {
  amount: number
  recipient_address: string
  token?: string
  description?: string
  customer_email?: string
  expires_at?: string
}

export interface Payment {
  id: string
  from_address: string
  to_address: string
  amount: string
  token: string
  chain: string
  network_type: 'EVM' | 'TRON'
  status: 'pending' | 'completed' | 'failed'
  tx_hash: string
  created_at: string
}

export interface PaymentFilters {
  status?: 'pending' | 'completed' | 'failed'
  network?: string
  network_type?: 'EVM' | 'TRON'
  page?: number
  limit?: number
}

export interface VerifyPaymentParams {
  txHash: string
  orderId: string
  amount: string
}

export interface Vendor {
  id: string
  name: string
  wallet_address: string
  owner_address: string
  category?: string
  tags?: string[]
}

export interface CreateVendorParams {
  name: string
  wallet_address: string
  category?: string
  tags?: string[]
}

export interface MultiNetworkAddress {
  network: string
  address: string
  label?: string
  isPrimary?: boolean
}

export interface CreateMultiNetworkVendorParams {
  name: string
  addresses: MultiNetworkAddress[]
}

export interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
}

export interface CreateWebhookParams {
  name: string
  url: string
  events: string[]
}

export interface YieldBalance {
  merchant: string
  network: string
  principal: string
  interest: string
  totalBalance: string
  apy: number
  protocol: string
  networkType: 'EVM' | 'TRON'
}

export interface CrossNetworkSummary {
  totalPrincipal: string
  totalInterest: string
  totalBalance: string
  averageAPY: number
  balances: YieldBalance[]
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
}

// ─── SDK Client ──────────────────────────────────────────────────────

export class ProtocolBanks {
  private baseUrl: string
  private walletAddress: string
  private apiKey?: string
  private timeout: number

  public invoices: InvoiceClient
  public payments: PaymentClient
  public vendors: VendorClient
  public webhooks: WebhookClient
  public yield: YieldClient
  public analytics: AnalyticsClient

  constructor(config: PBConfig) {
    this.baseUrl = (config.baseUrl || 'https://app.protocolbanks.com/api').replace(/\/$/, '')
    this.walletAddress = config.walletAddress
    this.apiKey = config.apiKey
    this.timeout = config.timeout || 30_000

    this.invoices = new InvoiceClient(this)
    this.payments = new PaymentClient(this)
    this.vendors = new VendorClient(this)
    this.webhooks = new WebhookClient(this)
    this.yield = new YieldClient(this)
    this.analytics = new AnalyticsClient(this)
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'x-wallet-address': this.walletAddress,
    }
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey
    }
    if (body) {
      headers['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      const json = await res.json()

      if (!res.ok) {
        const msg = json.error || `HTTP ${res.status}`
        throw new ProtocolBanksError(msg, res.status, json)
      }

      return json as T
    } finally {
      clearTimeout(timer)
    }
  }

  /** Quick health check �?no auth required */
  async health(): Promise<{ status: string; timestamp: string }> {
    const res = await fetch(`${this.baseUrl}/health`)
    return res.json()
  }
}

// ─── Error Class ─────────────────────────────────────────────────────

export class ProtocolBanksError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ProtocolBanksError'
    this.status = status
    this.body = body
  }
}

// ─── Resource Clients ────────────────────────────────────────────────

class InvoiceClient {
  constructor(private sdk: ProtocolBanks) {}

  async list(): Promise<ApiResponse<Invoice[]>> {
    return this.sdk.request('GET', '/invoice')
  }

  async create(params: CreateInvoiceParams): Promise<ApiResponse<Invoice>> {
    return this.sdk.request('POST', '/invoice', params)
  }
}

class PaymentClient {
  constructor(private sdk: ProtocolBanks) {}

  async list(filters?: PaymentFilters): Promise<ApiResponse<Payment[]>> {
    const qs = new URLSearchParams()
    if (filters) {
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined) qs.set(k, String(v))
      }
    }
    const query = qs.toString()
    return this.sdk.request('GET', `/payments${query ? `?${query}` : ''}`)
  }

  async verify(params: VerifyPaymentParams): Promise<ApiResponse<{ valid: boolean; reason?: string }>> {
    return this.sdk.request('POST', '/verify-payment', params)
  }
}

class VendorClient {
  constructor(private sdk: ProtocolBanks) {}

  async list(): Promise<ApiResponse<Vendor[]>> {
    return this.sdk.request('GET', '/vendors')
  }

  async create(params: CreateVendorParams): Promise<ApiResponse<Vendor>> {
    return this.sdk.request('POST', '/vendors', params)
  }

  async createMultiNetwork(params: CreateMultiNetworkVendorParams): Promise<ApiResponse<Vendor>> {
    return this.sdk.request('POST', '/vendors/multi-network', params)
  }
}

class WebhookClient {
  constructor(private sdk: ProtocolBanks) {}

  async list(): Promise<ApiResponse<Webhook[]>> {
    return this.sdk.request('GET', '/webhooks')
  }

  async create(params: CreateWebhookParams): Promise<ApiResponse<Webhook>> {
    return this.sdk.request('POST', '/webhooks', params)
  }
}

class YieldClient {
  constructor(private sdk: ProtocolBanks) {}

  async balance(merchant: string, network: string): Promise<ApiResponse<YieldBalance>> {
    return this.sdk.request('GET', `/yield/balance?merchant=${encodeURIComponent(merchant)}&network=${encodeURIComponent(network)}`)
  }

  async summary(merchant: string): Promise<ApiResponse<CrossNetworkSummary>> {
    return this.sdk.request('GET', `/yield/balance?merchant=${encodeURIComponent(merchant)}&summary=true`)
  }

  async stats(network?: string): Promise<ApiResponse<unknown>> {
    const qs = network ? `?network=${encodeURIComponent(network)}` : ''
    return this.sdk.request('GET', `/yield/stats${qs}`)
  }

  async recommendation(): Promise<ApiResponse<{ recommendation: { network: string; apy: number; protocol: string }; supportedNetworks: string[] }>> {
    return this.sdk.request('GET', '/yield/recommendation')
  }
}

class AnalyticsClient {
  constructor(private sdk: ProtocolBanks) {}

  async summary(): Promise<ApiResponse<unknown>> {
    return this.sdk.request('GET', '/analytics/summary')
  }

  async monthly(): Promise<ApiResponse<unknown>> {
    return this.sdk.request('GET', '/analytics/monthly')
  }

  async byChain(): Promise<ApiResponse<unknown>> {
    return this.sdk.request('GET', '/analytics/by-chain')
  }

  async byVendor(): Promise<ApiResponse<unknown>> {
    return this.sdk.request('GET', '/analytics/by-vendor')
  }
}
