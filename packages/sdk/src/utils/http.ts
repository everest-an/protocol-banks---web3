/**
 * ProtocolBanks SDK - HTTP Client
 * 
 * 高并发 HTTP 客户端，支持:
 * - JWT Token 认证和自动刷新
 * - 指数退避重试
 * - 速率限制处理
 * - 请求队列 (支持 10,000+ 并发)
 * - 请求/响应拦截器
 */

import type {
  RetryConfig,
  RateLimitConfig,
  JWTConfig,
  SDKError,
  APIResponse,
  TokenPair,
  Logger,
} from '../types';
import { ErrorCodes } from '../types';
import { ProtocolBanksError } from './errors';

// ============================================================================
// Types
// ============================================================================

/** HTTP method */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Request options */
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  skipAuth?: boolean;
  retryCount?: number;
  signal?: AbortSignal;
}

/** Request interceptor */
export type RequestInterceptor = (
  url: string,
  options: RequestOptions
) => Promise<{ url: string; options: RequestOptions }>;

/** Response interceptor */
export type ResponseInterceptor = (
  response: Response,
  data: unknown
) => Promise<unknown>;

/** Queued request */
interface QueuedRequest {
  url: string;
  options: RequestOptions;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerSecond: 100,
  maxConcurrent: 50,
  queueSize: 10000,
};

const DEFAULT_JWT_CONFIG: JWTConfig = {
  algorithm: 'HS256',
  expiresIn: 3600,
  refreshThreshold: 300,
};

// ============================================================================
// HTTP Client Class
// ============================================================================

export class HttpClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private timeout: number;
  private retryConfig: RetryConfig;
  private rateLimitConfig: RateLimitConfig;
  private jwtConfig: JWTConfig;
  private logger?: Logger;
  
  // Token management
  private tokenPair: TokenPair | null = null;
  private tokenRefreshPromise: Promise<TokenPair> | null = null;
  
  // Rate limiting
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = 0;
  private requestTimestamps: number[] = [];
  private isProcessingQueue = false;
  
  // Interceptors
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  
  constructor(config: {
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    timeout?: number;
    retryConfig?: Partial<RetryConfig>;
    rateLimitConfig?: Partial<RateLimitConfig>;
    jwtConfig?: Partial<JWTConfig>;
    logger?: Logger;
  }) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.timeout = config.timeout ?? 30000;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.rateLimitConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config.rateLimitConfig };
    this.jwtConfig = { ...DEFAULT_JWT_CONFIG, ...config.jwtConfig };
    this.logger = config.logger;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /** GET request */
  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /** POST request */
  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /** PUT request */
  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }

  /** DELETE request */
  async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /** PATCH request */
  async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /** Add request interceptor */
  addRequestInterceptor(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  /** Add response interceptor */
  addResponseInterceptor(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  /** Set token pair (for external token management) */
  setTokenPair(tokenPair: TokenPair): void {
    this.tokenPair = tokenPair;
  }

  /** Get current token pair */
  getTokenPair(): TokenPair | null {
    return this.tokenPair;
  }

  /** Clear tokens */
  clearTokens(): void {
    this.tokenPair = null;
    this.tokenRefreshPromise = null;
  }

  /** Get queue stats */
  getQueueStats(): { queued: number; active: number; rps: number } {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(t => now - t < 1000);
    return {
      queued: this.requestQueue.length,
      active: this.activeRequests,
      rps: recentRequests.length,
    };
  }

  // ============================================================================
  // Core Request Method
  // ============================================================================

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    // Check queue size limit
    if (this.requestQueue.length >= this.rateLimitConfig.queueSize) {
      throw new ProtocolBanksError({
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        category: 'RATE',
        message: 'Request queue is full. Please try again later.',
        retryable: true,
        retryAfter: 5,
      });
    }

    // Add to queue and process
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve: resolve as (value: unknown) => void,
        reject,
        timestamp: Date.now(),
      });
      this.processQueue();
    });
  }

  // ============================================================================
  // Queue Processing
  // ============================================================================

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check rate limits
      if (!this.canMakeRequest()) {
        await this.waitForRateLimit();
        continue;
      }

      const request = this.requestQueue.shift();
      if (!request) break;

      this.activeRequests++;
      this.requestTimestamps.push(Date.now());

      // Execute request without blocking queue
      this.executeRequest(request)
        .then(result => request.resolve(result))
        .catch(error => request.reject(error))
        .finally(() => {
          this.activeRequests--;
          // Clean old timestamps
          const now = Date.now();
          this.requestTimestamps = this.requestTimestamps.filter(t => now - t < 1000);
        });
    }

    this.isProcessingQueue = false;
  }

  private canMakeRequest(): boolean {
    const now = Date.now();
    const recentRequests = this.requestTimestamps.filter(t => now - t < 1000);
    
    return (
      this.activeRequests < this.rateLimitConfig.maxConcurrent &&
      recentRequests.length < this.rateLimitConfig.maxRequestsPerSecond
    );
  }

  private async waitForRateLimit(): Promise<void> {
    const waitTime = Math.ceil(1000 / this.rateLimitConfig.maxRequestsPerSecond);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // ============================================================================
  // Request Execution
  // ============================================================================

  private async executeRequest(request: QueuedRequest): Promise<unknown> {
    let { url, options } = request;
    const retryCount = options.retryCount ?? 0;

    try {
      // Run request interceptors
      for (const interceptor of this.requestInterceptors) {
        const result = await interceptor(url, options);
        url = result.url;
        options = result.options;
      }

      // Ensure valid token
      if (!options.skipAuth) {
        await this.ensureValidToken();
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'X-Request-ID': this.generateRequestId(),
        ...options.headers,
      };

      // Add authorization header
      if (!options.skipAuth && this.tokenPair) {
        headers['Authorization'] = `Bearer ${this.tokenPair.accessToken}`;
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.timeout);

      try {
        const response = await fetch(url, {
          method: options.method ?? 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: options.signal ?? controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse response
        let data: unknown;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        // Run response interceptors
        for (const interceptor of this.responseInterceptors) {
          data = await interceptor(response, data);
        }

        // Handle errors
        if (!response.ok) {
          return this.handleErrorResponse(response, data, request, retryCount);
        }

        // Return data
        const apiResponse = data as APIResponse<unknown>;
        if (apiResponse.success === false && apiResponse.error) {
          throw new ProtocolBanksError(apiResponse.error);
        }

        return apiResponse.data ?? data;

      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error) {
      return this.handleRequestError(error, request, retryCount);
    }
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private async handleErrorResponse(
    response: Response,
    data: unknown,
    request: QueuedRequest,
    retryCount: number
  ): Promise<unknown> {
    const apiResponse = data as APIResponse<unknown>;
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10);
      
      if (retryCount < this.retryConfig.maxRetries) {
        this.logger?.warn(`Rate limited, retrying after ${retryAfter}s`);
        await this.sleep(retryAfter * 1000);
        return this.executeRequest({
          ...request,
          options: { ...request.options, retryCount: retryCount + 1 },
        });
      }

      throw new ProtocolBanksError({
        code: ErrorCodes.RATE_LIMIT_EXCEEDED,
        category: 'RATE',
        message: 'Rate limit exceeded',
        retryable: true,
        retryAfter,
      });
    }

    // Handle authentication errors
    if (response.status === 401) {
      // Try to refresh token
      if (!request.options.skipAuth && retryCount === 0) {
        try {
          await this.refreshToken();
          return this.executeRequest({
            ...request,
            options: { ...request.options, retryCount: 1 },
          });
        } catch {
          // Token refresh failed
        }
      }

      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_TOKEN_INVALID,
        category: 'AUTH',
        message: 'Authentication failed',
        retryable: false,
      });
    }

    // Handle server errors with retry
    if (response.status >= 500 && retryCount < this.retryConfig.maxRetries) {
      const delay = this.calculateRetryDelay(retryCount);
      this.logger?.warn(`Server error ${response.status}, retrying in ${delay}ms`);
      await this.sleep(delay);
      return this.executeRequest({
        ...request,
        options: { ...request.options, retryCount: retryCount + 1 },
      });
    }

    // Throw error from response
    if (apiResponse.error) {
      throw new ProtocolBanksError(apiResponse.error);
    }

    throw new ProtocolBanksError({
      code: `PB_NET_${response.status}`,
      category: 'NET',
      message: `HTTP ${response.status}: ${response.statusText}`,
      retryable: response.status >= 500,
    });
  }

  private async handleRequestError(
    error: unknown,
    request: QueuedRequest,
    retryCount: number
  ): Promise<unknown> {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        this.logger?.warn(`Request timeout, retrying in ${delay}ms`);
        await this.sleep(delay);
        return this.executeRequest({
          ...request,
          options: { ...request.options, retryCount: retryCount + 1 },
        });
      }

      throw new ProtocolBanksError({
        code: ErrorCodes.NET_TIMEOUT,
        category: 'NET',
        message: 'Request timeout',
        retryable: true,
      });
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.calculateRetryDelay(retryCount);
        this.logger?.warn(`Network error, retrying in ${delay}ms`);
        await this.sleep(delay);
        return this.executeRequest({
          ...request,
          options: { ...request.options, retryCount: retryCount + 1 },
        });
      }

      throw new ProtocolBanksError({
        code: ErrorCodes.NET_CONNECTION_FAILED,
        category: 'NET',
        message: 'Network connection failed',
        retryable: true,
      });
    }

    // Re-throw ProtocolBanksError
    if (error instanceof ProtocolBanksError) {
      throw error;
    }

    // Wrap unknown errors
    throw new ProtocolBanksError({
      code: ErrorCodes.NET_CONNECTION_FAILED,
      category: 'NET',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: false,
      details: error,
    });
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  private async ensureValidToken(): Promise<void> {
    // No token yet, authenticate
    if (!this.tokenPair) {
      await this.authenticate();
      return;
    }

    // Check if token needs refresh
    const now = new Date();
    const expiresAt = new Date(this.tokenPair.expiresAt);
    const refreshThreshold = this.jwtConfig.refreshThreshold * 1000;

    if (expiresAt.getTime() - now.getTime() < refreshThreshold) {
      await this.refreshToken();
    }
  }

  private async authenticate(): Promise<void> {
    // Prevent concurrent authentication
    if (this.tokenRefreshPromise) {
      await this.tokenRefreshPromise;
      return;
    }

    this.tokenRefreshPromise = this.doAuthenticate();
    
    try {
      this.tokenPair = await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async doAuthenticate(): Promise<TokenPair> {
    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        grantType: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_INVALID_API_KEY,
        category: 'AUTH',
        message: 'Authentication failed: Invalid API credentials',
        retryable: false,
      });
    }

    const data = await response.json() as APIResponse<TokenPair>;
    if (!data.success || !data.data) {
      throw new ProtocolBanksError({
        code: ErrorCodes.AUTH_INVALID_API_KEY,
        category: 'AUTH',
        message: 'Authentication failed',
        retryable: false,
      });
    }

    this.logger?.info('Successfully authenticated');
    return data.data;
  }

  private async refreshToken(): Promise<void> {
    if (!this.tokenPair) {
      await this.authenticate();
      return;
    }

    // Prevent concurrent refresh
    if (this.tokenRefreshPromise) {
      await this.tokenRefreshPromise;
      return;
    }

    this.tokenRefreshPromise = this.doRefreshToken();
    
    try {
      this.tokenPair = await this.tokenRefreshPromise;
    } catch {
      // Refresh failed, try full authentication
      this.tokenPair = null;
      await this.authenticate();
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async doRefreshToken(): Promise<TokenPair> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({
        refreshToken: this.tokenPair?.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json() as APIResponse<TokenPair>;
    if (!data.success || !data.data) {
      throw new Error('Token refresh failed');
    }

    this.logger?.info('Successfully refreshed token');
    return data.data;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private calculateRetryDelay(retryCount: number): number {
    const delay = this.retryConfig.initialDelay * 
      Math.pow(this.retryConfig.backoffMultiplier, retryCount);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
