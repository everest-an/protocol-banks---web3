/**
 * Coinbase CDP Facilitator Service
 * 
 * 用于 x402 协议的支付验证和结算
 * - Base 链 USDC 支付 0 手续费
 * - 高性能结算
 * - 与 MCPay 生态兼容
 */

// ============================================================================
// Types
// ============================================================================

export interface CDPFacilitatorConfig {
  apiKey: string;
  apiSecret: string;
  network: 'base' | 'base-sepolia';
  endpoint?: string;
  timeout?: number;
}

export interface PaymentPayload {
  signature: string;
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: number;
    validBefore: number;
    nonce: string;
  };
}

export interface PaymentRequirements {
  scheme: 'exact';
  network: string;
  maxAmountRequired: string;
  resource: string;
  description?: string;
  mimeType?: string;
  payTo?: string;
}

export interface SettleRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
}

export interface SettleResponse {
  success: boolean;
  transactionHash?: string;
  network?: string;
  payer?: string;
  error?: string;
  errorCode?: string;
}

export interface VerifyResponse {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

export interface TransactionStatus {
  transactionHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
  blockNumber?: number;
  error?: string;
}


// ============================================================================
// Constants
// ============================================================================

const CDP_ENDPOINTS = {
  'base': 'https://api.cdp.coinbase.com/x402',
  'base-sepolia': 'https://api.cdp.coinbase.com/x402/testnet',
} as const;

const DEFAULT_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// CDP Facilitator Service
// ============================================================================

export class CDPFacilitatorService {
  private config: Required<CDPFacilitatorConfig>;
  private baseUrl: string;

  constructor(config: CDPFacilitatorConfig) {
    this.config = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      network: config.network,
      endpoint: config.endpoint || CDP_ENDPOINTS[config.network],
      timeout: config.timeout || DEFAULT_TIMEOUT,
    };
    this.baseUrl = this.config.endpoint;
  }

  // --------------------------------------------------------------------------
  // Public Methods
  // --------------------------------------------------------------------------

  /**
   * 验证支付 payload 是否有效
   */
  async verify(request: SettleRequest): Promise<VerifyResponse> {
    try {
      const response = await this.makeRequest('/verify', request);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: error.message || 'Verification failed',
          errorCode: error.code,
        };
      }

      const data = await response.json();
      return {
        valid: data.valid ?? true,
        error: data.error,
      };
    } catch (error) {
      console.error('[CDP] Verify error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 结算支付到链上
   */
  async settle(request: SettleRequest): Promise<SettleResponse> {
    try {
      // 先验证
      const verifyResult = await this.verify(request);
      if (!verifyResult.valid) {
        return {
          success: false,
          error: verifyResult.error || 'Payment verification failed',
          errorCode: verifyResult.errorCode,
        };
      }

      // 提交结算
      const response = await this.makeRequest('/settle', request);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          error: error.message || 'Settlement failed',
          errorCode: error.code,
        };
      }

      const data = await response.json();
      return {
        success: true,
        transactionHash: data.transactionHash || data.txHash,
        network: data.network || this.config.network,
        payer: data.payer || request.paymentPayload.authorization.from,
      };
    } catch (error) {
      console.error('[CDP] Settle error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 查询交易状态
   */
  async getStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const response = await this.makeRequest(`/status/${txHash}`, null, 'GET');
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          transactionHash: txHash,
          status: 'failed',
          error: error.message || 'Status check failed',
        };
      }

      const data = await response.json();
      return {
        transactionHash: txHash,
        status: data.status || 'pending',
        confirmations: data.confirmations,
        blockNumber: data.blockNumber,
      };
    } catch (error) {
      console.error('[CDP] Status check error:', error);
      return {
        transactionHash: txHash,
        status: 'pending',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 检查服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', null, 'GET');
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前网络
   */
  getNetwork(): string {
    return this.config.network;
  }

  /**
   * 检查是否为测试网
   */
  isTestnet(): boolean {
    return this.config.network === 'base-sepolia';
  }


  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private async makeRequest(
    path: string,
    body: unknown,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // 生成签名 (HMAC-SHA256)
    const signature = await this.generateSignature(method, path, timestamp, body);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-CDP-API-Key': this.config.apiKey,
      'X-CDP-Timestamp': timestamp,
      'X-CDP-Signature': signature,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  private async generateSignature(
    method: string,
    path: string,
    timestamp: string,
    body: unknown
  ): Promise<string> {
    const bodyStr = body ? JSON.stringify(body) : '';
    const message = `${timestamp}${method}${path}${bodyStr}`;
    
    // 使用 Web Crypto API 生成 HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.config.apiSecret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    
    // 转换为 hex 字符串
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let cdpInstance: CDPFacilitatorService | null = null;

/**
 * 获取 CDP Facilitator 单例
 */
export function getCDPFacilitator(): CDPFacilitatorService | null {
  if (cdpInstance) {
    return cdpInstance;
  }

  // 使用 globalThis 访问 Node.js 环境变量
  const env = typeof globalThis !== 'undefined' && 'process' in globalThis 
    ? (globalThis as any).process?.env 
    : {};
  
  const apiKey = env.CDP_API_KEY;
  const apiSecret = env.CDP_API_SECRET;
  const network = (env.CDP_NETWORK || 'base') as 'base' | 'base-sepolia';

  if (!apiKey || !apiSecret) {
    console.warn('[CDP] Missing CDP_API_KEY or CDP_API_SECRET');
    return null;
  }

  cdpInstance = new CDPFacilitatorService({
    apiKey,
    apiSecret,
    network,
    endpoint: env.CDP_FACILITATOR_ENDPOINT,
  });

  return cdpInstance;
}

/**
 * 创建新的 CDP Facilitator 实例
 */
export function createCDPFacilitator(config: CDPFacilitatorConfig): CDPFacilitatorService {
  return new CDPFacilitatorService(config);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 构建支付 payload
 */
export function buildPaymentPayload(params: {
  signature: string;
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
}): PaymentPayload {
  return {
    signature: params.signature,
    authorization: {
      from: params.from,
      to: params.to,
      value: params.value,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      nonce: params.nonce,
    },
  };
}

/**
 * 构建支付要求
 */
export function buildPaymentRequirements(params: {
  amount: string;
  payTo: string;
  resource?: string;
  description?: string;
}): PaymentRequirements {
  return {
    scheme: 'exact',
    network: 'base',
    maxAmountRequired: params.amount,
    resource: params.resource || 'payment',
    description: params.description,
    payTo: params.payTo,
  };
}

/**
 * 检查是否支持 CDP 结算
 */
export function isCDPSupported(chainId: number, token: string): boolean {
  // CDP 目前仅支持 Base 链 USDC
  return chainId === 8453 && token.toUpperCase() === 'USDC';
}

/**
 * 检查是否支持 CDP 测试网结算
 */
export function isCDPTestnetSupported(chainId: number, token: string): boolean {
  // Base Sepolia 测试网
  return chainId === 84532 && token.toUpperCase() === 'USDC';
}
