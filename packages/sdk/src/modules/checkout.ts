/**
 * ProtocolBanks Checkout Module
 * 
 * 托管结账页面和会话管理
 */

import type {
  CheckoutConfig,
  CheckoutSession,
  CheckoutResult,
  ICheckoutModule,
  ChainId,
  TokenSymbol,
} from '../types';
import type { HttpClient } from '../utils/http';
import { generateEmbedCode, type EmbedCodeOptions } from '../utils/embed-generator';
import { ProtocolBanksError, ErrorCodes } from '../utils/errors';

// ============================================================================
// Checkout Module
// ============================================================================

export class CheckoutModule implements ICheckoutModule {
  private readonly http: HttpClient;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private currentSession: CheckoutSession | null = null;
  
  constructor(http: HttpClient, apiKey: string, baseUrl: string) {
    this.http = http;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  /**
   * Create a checkout session
   * Returns a hosted checkout URL
   */
  async createSession(config: CheckoutConfig): Promise<CheckoutSession> {
    this.validateConfig(config);
    
    const response = await this.http.post<CheckoutSession>('/checkout/sessions', {
      amount: config.amount,
      currency: config.currency,
      token: config.token || 'USDC',
      chain: config.chain,
      allowedChains: config.allowedChains,
      allowedTokens: config.allowedTokens,
      recipientAddress: config.recipientAddress,
      orderId: config.orderId,
      memo: config.memo,
      callbackUrl: config.callbackUrl,
      webhookUrl: config.webhookUrl,
      theme: config.theme,
      locale: config.locale,
      metadata: config.metadata,
    });
    
    this.currentSession = response;
    return response;
  }

  /**
   * Get checkout session status
   */
  async getSessionStatus(sessionId: string): Promise<CheckoutResult> {
    if (!sessionId) {
      throw new ProtocolBanksError(
        ErrorCodes.VALID_REQUIRED_FIELD,
        'Session ID is required'
      );
    }
    
    return this.http.get<CheckoutResult>(`/checkout/sessions/${sessionId}`);
  }
  
  /**
   * Open checkout in a new window/popup
   * For browser environments
   */
  async open(config: CheckoutConfig): Promise<CheckoutResult> {
    const session = await this.createSession(config);
    
    return new Promise((resolve, reject) => {
      // Open popup
      const width = 450;
      const height = 700;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const popup = window.open(
        session.url,
        'pb-checkout',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
      );
      
      if (!popup) {
        reject(new Error('Failed to open checkout popup. Please allow popups.'));
        return;
      }
      
      // Listen for messages from popup
      const messageHandler = (event: MessageEvent) => {
        if (!event.origin.includes('protocolbanks.com')) return;
        
        const { type, data } = event.data;
        
        if (type === 'pb-checkout-success') {
          window.removeEventListener('message', messageHandler);
          resolve(data as CheckoutResult);
        } else if (type === 'pb-checkout-error') {
          window.removeEventListener('message', messageHandler);
          reject(new Error(data.message));
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('Checkout was cancelled'));
        }
      }, 500);
    });
  }
  
  /**
   * Close current checkout
   */
  close(): void {
    this.currentSession = null;
  }
  
  /**
   * Get embed code for checkout
   */
  getEmbedCode(config: CheckoutConfig): string {
    const options: EmbedCodeOptions = {
      apiKey: this.apiKey,
      amount: config.amount,
      recipientAddress: config.recipientAddress,
      token: config.token,
      chain: config.chain,
      orderId: config.orderId,
      memo: config.memo,
      callbackUrl: config.callbackUrl,
      webhookUrl: config.webhookUrl,
      locale: config.locale,
      theme: config.theme,
    };
    
    return generateEmbedCode(options).script;
  }

  /**
   * Get all embed code variants
   */
  getAllEmbedCodes(config: CheckoutConfig) {
    const options: EmbedCodeOptions = {
      apiKey: this.apiKey,
      amount: config.amount,
      recipientAddress: config.recipientAddress,
      token: config.token,
      chain: config.chain,
      orderId: config.orderId,
      memo: config.memo,
      callbackUrl: config.callbackUrl,
      webhookUrl: config.webhookUrl,
      locale: config.locale,
      theme: config.theme,
    };
    
    return generateEmbedCode(options);
  }
  
  /**
   * Generate hosted checkout URL
   */
  getHostedUrl(sessionId: string): string {
    return `${this.baseUrl.replace('/api', '')}/checkout/${sessionId}`;
  }
  
  /**
   * Validate checkout config
   */
  private validateConfig(config: CheckoutConfig): void {
    if (!config.amount || parseFloat(config.amount) <= 0) {
      throw new ProtocolBanksError(
        ErrorCodes.VALID_REQUIRED_FIELD,
        'Valid amount is required'
      );
    }
    
    if (!config.recipientAddress) {
      throw new ProtocolBanksError(
        ErrorCodes.VALID_REQUIRED_FIELD,
        'Recipient address is required'
      );
    }
    
    // Validate address format based on chain
    if (config.chain === 'solana') {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(config.recipientAddress)) {
        throw new ProtocolBanksError(
          ErrorCodes.LINK_INVALID_ADDRESS,
          'Invalid Solana address format'
        );
      }
    } else if (config.chain === 'bitcoin') {
      if (!/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(config.recipientAddress)) {
        throw new ProtocolBanksError(
          ErrorCodes.LINK_INVALID_ADDRESS,
          'Invalid Bitcoin address format'
        );
      }
    } else {
      // EVM address
      if (!/^0x[a-fA-F0-9]{40}$/.test(config.recipientAddress)) {
        throw new ProtocolBanksError(
          ErrorCodes.LINK_INVALID_ADDRESS,
          'Invalid EVM address format'
        );
      }
    }
  }
}

// ============================================================================
// Hosted Checkout Page Generator
// ============================================================================

/**
 * Generate HTML for hosted checkout page
 * This is used by the server to render /checkout/:sessionId
 */
export function generateHostedCheckoutPage(session: CheckoutSession): string {
  const { config } = session;
  const theme = config.theme || {};
  
  return `<!DOCTYPE html>
<html lang="${config.locale || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkout - ${theme.companyName || 'ProtocolBanks'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${theme.backgroundColor || '#f5f5f5'};
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .checkout-container {
      background: white;
      border-radius: ${theme.borderRadius || '16px'};
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      max-width: 420px;
      width: 100%;
      overflow: hidden;
    }
    .checkout-header {
      padding: 24px;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .checkout-logo {
      width: 40px;
      height: 40px;
      border-radius: 8px;
    }
    .checkout-title {
      font-size: 18px;
      font-weight: 600;
      color: ${theme.textColor || '#1a1a1a'};
    }
    .checkout-body {
      padding: 24px;
    }
    .amount-display {
      text-align: center;
      padding: 32px 0;
    }
    .amount-value {
      font-size: 48px;
      font-weight: 700;
      color: ${theme.textColor || '#1a1a1a'};
    }
    .amount-token {
      font-size: 16px;
      color: #666;
      margin-top: 4px;
    }
    #checkout-widget {
      min-height: 300px;
    }
  </style>
</head>
<body>
  <div class="checkout-container">
    <div class="checkout-header">
      ${theme.logo ? `<img src="${theme.logo}" alt="" class="checkout-logo">` : ''}
      <span class="checkout-title">${theme.companyName || 'Checkout'}</span>
    </div>
    <div class="checkout-body">
      <div class="amount-display">
        <div class="amount-value">${config.amount}</div>
        <div class="amount-token">${config.token || 'USDC'}</div>
      </div>
      <div id="checkout-widget"></div>
    </div>
  </div>
  <script src="https://sdk.protocolbanks.com/checkout.js"></script>
  <script>
    window.PBCheckout.open({
      apiKey: '${session.sessionId}',
      amount: '${config.amount}',
      recipient: '${config.recipientAddress}',
      token: '${config.token || 'USDC'}',
      onSuccess: function(result) {
        window.parent.postMessage({ type: 'pb-checkout-success', data: result }, '*');
        ${config.callbackUrl ? `window.location.href = '${config.callbackUrl}?status=success&paymentId=' + result.paymentId;` : ''}
      },
      onError: function(error) {
        window.parent.postMessage({ type: 'pb-checkout-error', data: { message: error.message } }, '*');
      }
    });
  </script>
</body>
</html>`;
}
