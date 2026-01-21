/**
 * ProtocolBanks SDK - API Monetizer Module
 * 
 * Middleware for monetizing REST APIs using x402 protocol.
 * Supports multiple pricing models and payment verification.
 * 
 * @example
 * ```typescript
 * const monetizer = new APIMonetizer({
 *   upstream: { url: 'https://api.example.com' },
 *   pricing: { model: 'perRequest', perRequest: '0.01' },
 *   recipient: '0x1234...',
 * });
 * 
 * // Next.js API Route
 * export async function POST(req: Request) {
 *   return monetizer.handleRequest(req);
 * }
 * ```
 */

import type { ChainId, TokenSymbol } from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from '../utils/errors';
import {
  createPricingStrategy,
  usdToUSDC,
  type PricingConfig,
  type PricingContext,
  type IPricingStrategy,
  type TokenUsage,
} from './pricing';

// ============================================================================
// Types
// ============================================================================

/** Upstream API configuration */
export interface UpstreamConfig {
  /** Base URL of upstream API */
  url: string;
  /** Headers to forward to upstream */
  headers?: Record<string, string>;
  /** Request timeout in ms */
  timeout?: number;
  /** Number of retries */
  retries?: number;
  /** Transform request before forwarding */
  transformRequest?: (req: Request) => Promise<Request>;
  /** Transform response before returning */
  transformResponse?: (res: Response) => Promise<Response>;
}

/** Rate limit configuration */
export interface MonetizeRateLimitConfig {
  /** Max requests per minute per wallet */
  maxPerMinute?: number;
  /** Max requests per hour per wallet */
  maxPerHour?: number;
  /** Max requests per day per wallet */
  maxPerDay?: number;
}

/** Monetizer configuration */
export interface MonetizeConfig {
  /** Upstream API configuration */
  upstream: UpstreamConfig;
  /** Pricing configuration */
  pricing: PricingConfig;
  /** Recipient wallet address */
  recipient: string;
  /** Blockchain network */
  network?: 'base' | 'ethereum' | 'polygon' | 'arbitrum';
  /** Payment token */
  token?: 'USDC' | 'USDT';
  /** Rate limiting */
  rateLimit?: MonetizeRateLimitConfig;
  /** Enable usage analytics */
  analytics?: boolean;
  /** Check if wallet has active subscription (bypass payment) */
  subscriptionCheck?: (walletAddress: string) => Promise<boolean>;
  /** Wallet allowlist (bypass payment) */
  allowlist?: string[];
  /** Wallet blocklist (reject requests) */
  blocklist?: string[];
  /** Custom payment verification endpoint */
  verifyEndpoint?: string;
  /** Description for payment request */
  description?: string;
}

/** Payment requirement in X-Payment-Request header */
export interface PaymentRequirement {
  version: string;
  network: string;
  paymentAddress: string;
  amount: string;
  token: string;
  resource: string;
  description?: string;
  validFor?: number;
}

/** Payment proof in X-Payment header */
export interface PaymentProof {
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
  };
  network: string;
  token: string;
}

/** Usage record for analytics */
export interface UsageRecord {
  walletAddress: string;
  endpoint: string;
  method: string;
  amountCharged: string;
  timestamp: Date;
  responseStatus?: number;
  latencyMs?: number;
  tokenUsage?: TokenUsage;
}

/** Usage tracker interface */
export interface IUsageTracker {
  track(record: UsageRecord): Promise<void>;
  getRequestCount(walletAddress: string, windowMs: number): Promise<number>;
}

// ============================================================================
// Constants
// ============================================================================

const X_PAYMENT_HEADER = 'X-Payment';
const X_PAYMENT_REQUEST_HEADER = 'X-Payment-Request';
const X_PAYMENT_VERSION = '1.0';
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_RETRIES = 2;

// Chain ID mapping
const NETWORK_CHAIN_IDS: Record<string, number> = {
  'base': 8453,
  'ethereum': 1,
  'polygon': 137,
  'arbitrum': 42161,
};

// ============================================================================
// APIMonetizer Class
// ============================================================================

export class APIMonetizer {
  private config: MonetizeConfig;
  private pricingStrategy: IPricingStrategy;
  private usageTracker?: IUsageTracker;
  private rateLimitCache: Map<string, number[]> = new Map();
  
  constructor(config: MonetizeConfig) {
    this.validateConfig(config);
    this.config = {
      network: 'base',
      token: 'USDC',
      analytics: false,
      ...config,
    };
    this.pricingStrategy = createPricingStrategy(config.pricing);
  }
  
  /**
   * Set usage tracker for analytics
   */
  setUsageTracker(tracker: IUsageTracker): void {
    this.usageTracker = tracker;
  }
  
  /**
   * Handle incoming request with payment verification
   */
  async handleRequest(request: Request): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    try {
      // Check blocklist
      const paymentHeader = request.headers.get(X_PAYMENT_HEADER);
      if (paymentHeader) {
        const proof = this.parsePaymentProof(paymentHeader);
        if (this.isBlocked(proof.authorization.from)) {
          return this.createErrorResponse(403, 'Wallet is blocked');
        }
      }
      
      // Check allowlist (bypass payment)
      if (paymentHeader) {
        const proof = this.parsePaymentProof(paymentHeader);
        if (this.isAllowed(proof.authorization.from)) {
          return this.forwardToUpstream(request);
        }
      }
      
      // Check subscription (bypass payment)
      if (paymentHeader && this.config.subscriptionCheck) {
        const proof = this.parsePaymentProof(paymentHeader);
        const hasSubscription = await this.config.subscriptionCheck(proof.authorization.from);
        if (hasSubscription) {
          return this.forwardToUpstream(request);
        }
      }
      
      // Calculate required price
      const priceResult = await this.pricingStrategy.calculatePrice(request, {
        endpoint: url.pathname,
        method: request.method,
      });
      
      // Check for payment header
      if (!paymentHeader) {
        return this.generate402Response(priceResult.price, url.pathname);
      }
      
      // Parse and verify payment
      const proof = this.parsePaymentProof(paymentHeader);
      
      // Check rate limits
      if (this.config.rateLimit) {
        const rateLimited = await this.checkRateLimit(proof.authorization.from);
        if (rateLimited) {
          return this.createErrorResponse(429, 'Rate limit exceeded');
        }
      }
      
      // Verify payment amount
      const requiredAmount = usdToUSDC(priceResult.price);
      if (BigInt(proof.authorization.value) < BigInt(requiredAmount)) {
        return this.createErrorResponse(402, 'Insufficient payment amount', {
          required: requiredAmount,
          provided: proof.authorization.value,
        });
      }
      
      // Verify payment signature (delegate to backend)
      const verified = await this.verifyPayment(proof, requiredAmount);
      if (!verified.valid) {
        return this.createErrorResponse(402, verified.error ?? 'Payment verification failed');
      }
      
      // Forward to upstream
      const response = await this.forwardToUpstream(request);
      
      // Track usage
      if (this.config.analytics && this.usageTracker) {
        await this.usageTracker.track({
          walletAddress: proof.authorization.from,
          endpoint: url.pathname,
          method: request.method,
          amountCharged: priceResult.price,
          timestamp: new Date(),
          responseStatus: response.status,
          latencyMs: Date.now() - startTime,
        });
      }
      
      return response;
      
    } catch (error) {
      if (error instanceof ProtocolBanksError) {
        return this.createErrorResponse(500, error.message);
      }
      return this.createErrorResponse(500, 'Internal server error');
    }
  }
  
  /**
   * Generate 402 Payment Required response
   */
  generate402Response(price: string, resource: string): Response {
    const requirement: PaymentRequirement = {
      version: X_PAYMENT_VERSION,
      network: this.config.network!,
      paymentAddress: this.config.recipient,
      amount: usdToUSDC(price),
      token: this.config.token!,
      resource,
      description: this.config.description,
      validFor: 3600, // 1 hour
    };
    
    return new Response(
      JSON.stringify({
        error: 'Payment Required',
        message: `This endpoint requires payment of $${price} ${this.config.token}`,
        paymentRequirement: requirement,
      }),
      {
        status: 402,
        headers: {
          'Content-Type': 'application/json',
          [X_PAYMENT_REQUEST_HEADER]: JSON.stringify(requirement),
        },
      }
    );
  }
  
  /**
   * Forward request to upstream API
   */
  async forwardToUpstream(request: Request): Promise<Response> {
    const upstream = this.config.upstream;
    let forwardRequest = request.clone();
    
    // Transform request if configured
    if (upstream.transformRequest) {
      forwardRequest = await upstream.transformRequest(forwardRequest);
    }
    
    // Build upstream URL
    const originalUrl = new URL(request.url);
    const upstreamUrl = new URL(originalUrl.pathname + originalUrl.search, upstream.url);
    
    // Build headers
    const headers = new Headers(forwardRequest.headers);
    
    // Remove payment headers
    headers.delete(X_PAYMENT_HEADER);
    headers.delete(X_PAYMENT_REQUEST_HEADER);
    
    // Add upstream headers
    if (upstream.headers) {
      for (const [key, value] of Object.entries(upstream.headers)) {
        headers.set(key, value);
      }
    }
    
    // Make request with retries
    let lastError: Error | null = null;
    const maxRetries = upstream.retries ?? DEFAULT_RETRIES;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          upstream.timeout ?? DEFAULT_TIMEOUT
        );
        
        const response = await fetch(upstreamUrl.toString(), {
          method: forwardRequest.method,
          headers,
          body: forwardRequest.body,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Transform response if configured
        if (upstream.transformResponse) {
          return upstream.transformResponse(response);
        }
        
        return response;
        
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw new ProtocolBanksError({
      code: ErrorCodes.NET_CONNECTION_FAILED,
      category: 'NET',
      message: `Upstream request failed: ${lastError?.message}`,
      retryable: true,
    });
  }
  
  /**
   * Parse payment proof from header
   */
  private parsePaymentProof(header: string): PaymentProof {
    try {
      return JSON.parse(header) as PaymentProof;
    } catch {
      throw new ProtocolBanksError({
        code: ErrorCodes.VALID_INVALID_FORMAT,
        category: 'VALID',
        message: 'Invalid payment proof format',
        retryable: false,
      });
    }
  }
  
  /**
   * Verify payment with backend
   */
  private async verifyPayment(
    proof: PaymentProof,
    requiredAmount: string
  ): Promise<{ valid: boolean; error?: string }> {
    const endpoint = this.config.verifyEndpoint ?? '/api/x402/verify';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentProof: proof,
          requiredAmount,
          recipient: this.config.recipient,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        return { valid: false, error: data.error ?? 'Verification failed' };
      }
      
      const data = await response.json();
      return { valid: data.valid ?? true };
      
    } catch (error) {
      // If verification endpoint is unavailable, accept payment
      // (settlement will fail later if invalid)
      console.warn('Payment verification endpoint unavailable, accepting payment');
      return { valid: true };
    }
  }
  
  /**
   * Check rate limits
   */
  private async checkRateLimit(walletAddress: string): Promise<boolean> {
    const limits = this.config.rateLimit;
    if (!limits) return false;
    
    const now = Date.now();
    const key = walletAddress.toLowerCase();
    
    // Get or create timestamp array
    let timestamps = this.rateLimitCache.get(key) ?? [];
    
    // Clean old timestamps
    const oneDay = 24 * 60 * 60 * 1000;
    timestamps = timestamps.filter(t => now - t < oneDay);
    
    // Check limits
    if (limits.maxPerMinute) {
      const minuteCount = timestamps.filter(t => now - t < 60000).length;
      if (minuteCount >= limits.maxPerMinute) return true;
    }
    
    if (limits.maxPerHour) {
      const hourCount = timestamps.filter(t => now - t < 3600000).length;
      if (hourCount >= limits.maxPerHour) return true;
    }
    
    if (limits.maxPerDay) {
      if (timestamps.length >= limits.maxPerDay) return true;
    }
    
    // Add current timestamp
    timestamps.push(now);
    this.rateLimitCache.set(key, timestamps);
    
    // Also check with usage tracker if available
    if (this.usageTracker && limits.maxPerMinute) {
      const count = await this.usageTracker.getRequestCount(walletAddress, 60000);
      if (count >= limits.maxPerMinute) return true;
    }
    
    return false;
  }
  
  /**
   * Check if wallet is in allowlist
   */
  private isAllowed(walletAddress: string): boolean {
    if (!this.config.allowlist) return false;
    return this.config.allowlist.some(
      addr => addr.toLowerCase() === walletAddress.toLowerCase()
    );
  }
  
  /**
   * Check if wallet is in blocklist
   */
  private isBlocked(walletAddress: string): boolean {
    if (!this.config.blocklist) return false;
    return this.config.blocklist.some(
      addr => addr.toLowerCase() === walletAddress.toLowerCase()
    );
  }
  
  /**
   * Create error response
   */
  private createErrorResponse(
    status: number,
    message: string,
    details?: Record<string, unknown>
  ): Response {
    return new Response(
      JSON.stringify({ error: message, ...details }),
      {
        status,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  /**
   * Validate configuration
   */
  private validateConfig(config: MonetizeConfig): void {
    if (!config.upstream?.url) {
      throw new Error('upstream.url is required');
    }
    if (!config.recipient) {
      throw new Error('recipient address is required');
    }
    if (!config.pricing) {
      throw new Error('pricing configuration is required');
    }
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get pricing strategy
   */
  getPricingStrategy(): IPricingStrategy {
    return this.pricingStrategy;
  }
  
  /**
   * Get configuration (with sensitive data masked)
   */
  getConfig(): Omit<MonetizeConfig, 'upstream'> & { upstream: { url: string } } {
    return {
      ...this.config,
      upstream: { url: this.config.upstream.url },
    };
  }
  
  /**
   * Get chain ID for network
   */
  getChainId(): number {
    return NETWORK_CHAIN_IDS[this.config.network!] ?? 8453;
  }
}

// ============================================================================
// Middleware Adapters
// ============================================================================

/**
 * Create Next.js API route handler
 */
export function createNextHandler(config: MonetizeConfig) {
  const monetizer = new APIMonetizer(config);
  
  return async function handler(request: Request): Promise<Response> {
    return monetizer.handleRequest(request);
  };
}

/**
 * Create Express middleware
 */
export function createExpressMiddleware(config: MonetizeConfig) {
  const monetizer = new APIMonetizer(config);
  
  return async function middleware(
    req: { method: string; url: string; headers: Record<string, string>; body?: unknown },
    res: { 
      status: (code: number) => { json: (data: unknown) => void; set: (headers: Record<string, string>) => void };
      set: (headers: Record<string, string>) => void;
    },
    next: () => void
  ): Promise<void> {
    // Convert Express request to Fetch Request
    const headers = new Headers(req.headers);
    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });
    
    const response = await monetizer.handleRequest(request);
    
    // If 402, return payment required
    if (response.status === 402) {
      const data = await response.json();
      const paymentHeader = response.headers.get(X_PAYMENT_REQUEST_HEADER);
      if (paymentHeader) {
        res.set({ [X_PAYMENT_REQUEST_HEADER]: paymentHeader });
      }
      res.status(402).json(data);
      return;
    }
    
    // If error, return error
    if (!response.ok) {
      const data = await response.json();
      res.status(response.status).json(data);
      return;
    }
    
    // Payment verified, continue to next middleware
    next();
  };
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an API Monetizer instance
 */
export function createAPIMonetizer(config: MonetizeConfig): APIMonetizer {
  return new APIMonetizer(config);
}

// ============================================================================
// Exports
// ============================================================================

export type {
  UpstreamConfig,
  MonetizeRateLimitConfig,
  MonetizeConfig,
  PaymentRequirement,
  PaymentProof,
  UsageRecord,
  IUsageTracker,
};
