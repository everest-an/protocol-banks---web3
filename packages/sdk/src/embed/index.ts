/**
 * ProtocolBanks Embedded Checkout Script
 * 
 * 一行代码集成加密货币收款
 * 
 * Usage:
 * <script src="https://sdk.protocolbanks.com/checkout.js"
 *         data-api-key="pk_live_xxx"
 *         data-amount="100"
 *         data-token="USDC"
 *         data-recipient="0x1234...">
 * </script>
 */

// ============================================================================
// Types
// ============================================================================

interface CheckoutOptions {
  apiKey: string;
  amount: string;
  token?: string;
  recipient: string;
  chain?: string;
  memo?: string;
  orderId?: string;
  callbackUrl?: string;
  webhookUrl?: string;
  locale?: string;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    logo?: string;
    companyName?: string;
    darkMode?: boolean;
  };
  onSuccess?: (result: CheckoutResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

interface CheckoutResult {
  success: boolean;
  paymentId: string;
  transactionHash?: string;
  chain: string;
  token: string;
  amount: string;
  error?: string;
}

// ============================================================================
// Checkout Widget Class
// ============================================================================

class PBCheckout {
  private options: CheckoutOptions;
  private modal: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private isOpen = false;
  
  constructor(options: CheckoutOptions) {
    this.options = options;
    this.setupMessageListener();
  }
  
  /** Open checkout modal */
  open(): void {
    if (this.isOpen) return;
    
    this.createModal();
    this.isOpen = true;
  }
  
  /** Close checkout modal */
  close(): void {
    if (!this.isOpen || !this.modal) return;
    
    document.body.removeChild(this.modal);
    this.modal = null;
    this.iframe = null;
    this.isOpen = false;
  }
  
  /** Update options */
  updateOptions(options: Partial<CheckoutOptions>): void {
    this.options = { ...this.options, ...options };
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private createModal(): void {
    // Create overlay
    this.modal = document.createElement('div');
    this.modal.id = 'pb-checkout-modal';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
      background: ${this.options.theme?.backgroundColor ?? '#ffffff'};
      border-radius: ${this.options.theme?.borderRadius ?? '12px'};
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 420px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      position: relative;
    `;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: ${this.options.theme?.textColor ?? '#666'};
      z-index: 10;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(0,0,0,0.1)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => {
      this.close();
      this.options.onCancel?.();
    };
    
    // Create iframe for checkout
    this.iframe = document.createElement('iframe');
    this.iframe.src = this.buildCheckoutUrl();
    this.iframe.style.cssText = `
      width: 100%;
      height: 600px;
      border: none;
    `;
    
    container.appendChild(closeBtn);
    container.appendChild(this.iframe);
    this.modal.appendChild(container);
    
    // Close on overlay click
    this.modal.onclick = (e) => {
      if (e.target === this.modal) {
        this.close();
        this.options.onCancel?.();
      }
    };
    
    // Close on escape key
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        this.options.onCancel?.();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.appendChild(this.modal);
  }
  
  private buildCheckoutUrl(): string {
    const baseUrl = 'https://app.protocolbanks.com/checkout';
    const params = new URLSearchParams({
      apiKey: this.options.apiKey,
      amount: this.options.amount,
      token: this.options.token ?? 'USDC',
      recipient: this.options.recipient,
      embed: 'true',
    });
    
    if (this.options.chain) params.set('chain', this.options.chain);
    if (this.options.memo) params.set('memo', this.options.memo);
    if (this.options.orderId) params.set('orderId', this.options.orderId);
    if (this.options.callbackUrl) params.set('callbackUrl', this.options.callbackUrl);
    if (this.options.locale) params.set('locale', this.options.locale);
    
    // Theme params
    if (this.options.theme) {
      const theme = this.options.theme;
      if (theme.primaryColor) params.set('primaryColor', theme.primaryColor);
      if (theme.backgroundColor) params.set('backgroundColor', theme.backgroundColor);
      if (theme.textColor) params.set('textColor', theme.textColor);
      if (theme.logo) params.set('logo', theme.logo);
      if (theme.companyName) params.set('companyName', theme.companyName);
      if (theme.darkMode) params.set('darkMode', 'true');
    }
    
    return `${baseUrl}?${params.toString()}`;
  }
  
  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      // Verify origin
      if (!event.origin.includes('protocolbanks.com')) return;
      
      const { type, data } = event.data as { type: string; data: unknown };
      
      switch (type) {
        case 'pb-checkout-success':
          this.close();
          this.options.onSuccess?.(data as CheckoutResult);
          break;
          
        case 'pb-checkout-error':
          this.close();
          this.options.onError?.(new Error((data as { message: string }).message));
          break;
          
        case 'pb-checkout-cancel':
          this.close();
          this.options.onCancel?.();
          break;
          
        case 'pb-checkout-resize':
          if (this.iframe) {
            this.iframe.style.height = `${(data as { height: number }).height}px`;
          }
          break;
      }
    });
  }
}

// ============================================================================
// Payment Button Class
// ============================================================================

class PBPaymentButton {
  private element: HTMLElement;
  private checkout: PBCheckout;
  
  constructor(element: HTMLElement, options: CheckoutOptions) {
    this.element = element;
    this.checkout = new PBCheckout(options);
    this.setupButton();
  }
  
  private setupButton(): void {
    // Style the button
    const style = this.element.getAttribute('data-style') ?? 'default';
    const size = this.element.getAttribute('data-size') ?? 'medium';
    
    this.applyStyles(style, size);
    
    // Add click handler
    this.element.onclick = (e) => {
      e.preventDefault();
      this.checkout.open();
    };
  }
  
  private applyStyles(style: string, size: string): void {
    const baseStyles = `
      cursor: pointer;
      border: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    `;
    
    const sizeStyles: Record<string, string> = {
      small: 'padding: 8px 16px; font-size: 14px; border-radius: 6px;',
      medium: 'padding: 12px 24px; font-size: 16px; border-radius: 8px;',
      large: 'padding: 16px 32px; font-size: 18px; border-radius: 10px;',
    };
    
    const styleVariants: Record<string, string> = {
      default: `
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
      `,
      minimal: `
        background: transparent;
        color: #6366f1;
        border: 2px solid #6366f1;
      `,
      branded: `
        background: #000000;
        color: white;
      `,
    };
    
    this.element.style.cssText = baseStyles + 
      (sizeStyles[size] ?? sizeStyles['medium']) + 
      (styleVariants[style] ?? styleVariants['default']);
    
    // Add hover effect
    this.element.onmouseover = () => {
      this.element.style.transform = 'translateY(-2px)';
      this.element.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
    };
    this.element.onmouseout = () => {
      this.element.style.transform = 'translateY(0)';
      this.element.style.boxShadow = 'none';
    };
    
    // Add icon if not present
    if (!this.element.querySelector('.pb-icon')) {
      const icon = document.createElement('span');
      icon.className = 'pb-icon';
      icon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v12M6 12h12"/>
        </svg>
      `;
      this.element.insertBefore(icon, this.element.firstChild);
    }
  }
}

// ============================================================================
// Auto-initialization
// ============================================================================

function initializeFromDataAttributes(): void {
  // Find script tag with data attributes
  const scripts = document.querySelectorAll('script[data-api-key]');
  
  scripts.forEach((script) => {
    const apiKey = script.getAttribute('data-api-key');
    const amount = script.getAttribute('data-amount');
    const recipient = script.getAttribute('data-recipient');
    
    if (!apiKey || !amount || !recipient) {
      console.error('[ProtocolBanks] Missing required attributes: data-api-key, data-amount, data-recipient');
      return;
    }
    
    const theme: CheckoutOptions['theme'] = {
      darkMode: script.getAttribute('data-dark-mode') === 'true',
    };
    
    const primaryColor = script.getAttribute('data-primary-color');
    const backgroundColor = script.getAttribute('data-background-color');
    const logo = script.getAttribute('data-logo');
    const companyName = script.getAttribute('data-company-name');
    
    if (primaryColor) theme.primaryColor = primaryColor;
    if (backgroundColor) theme.backgroundColor = backgroundColor;
    if (logo) theme.logo = logo;
    if (companyName) theme.companyName = companyName;
    
    const options: CheckoutOptions = {
      apiKey,
      amount,
      recipient,
      token: script.getAttribute('data-token') ?? 'USDC',
      theme,
    };
    
    const chain = script.getAttribute('data-chain');
    const memo = script.getAttribute('data-memo');
    const orderId = script.getAttribute('data-order-id');
    const callbackUrl = script.getAttribute('data-callback-url');
    const locale = script.getAttribute('data-locale');
    
    if (chain) options.chain = chain;
    if (memo) options.memo = memo;
    if (orderId) options.orderId = orderId;
    if (callbackUrl) options.callbackUrl = callbackUrl;
    if (locale) options.locale = locale;
    
    // Auto-open if data-auto-open is set
    if (script.getAttribute('data-auto-open') === 'true') {
      const checkout = new PBCheckout(options);
      checkout.open();
    }
  });
  
  // Initialize checkout containers
  const containers = document.querySelectorAll('[data-pb-checkout]');
  containers.forEach((container) => {
    const apiKey = container.getAttribute('data-api-key');
    const amount = container.getAttribute('data-amount');
    const recipient = container.getAttribute('data-recipient');
    
    if (!apiKey || !amount || !recipient) return;
    
    const options: CheckoutOptions = {
      apiKey,
      amount,
      recipient,
      token: container.getAttribute('data-token') ?? 'USDC',
    };
    
    // Create inline checkout button
    const button = document.createElement('button');
    button.textContent = container.getAttribute('data-label') ?? 'Pay with Crypto';
    button.className = 'pb-pay-button';
    container.appendChild(button);
    
    new PBPaymentButton(button, options);
  });
  
  // Initialize payment buttons
  const buttons = document.querySelectorAll('.pb-pay-button[data-amount]');
  buttons.forEach((button) => {
    const apiKey = button.getAttribute('data-api-key') ?? 
      document.querySelector('script[data-api-key]')?.getAttribute('data-api-key');
    const amount = button.getAttribute('data-amount');
    const recipient = button.getAttribute('data-recipient');
    
    if (!apiKey || !amount || !recipient) return;
    
    const options: CheckoutOptions = {
      apiKey,
      amount,
      recipient,
      token: button.getAttribute('data-token') ?? 'USDC',
    };
    
    new PBPaymentButton(button as HTMLElement, options);
  });
}

// ============================================================================
// Global API
// ============================================================================

const PBCheckoutAPI = {
  /** Create checkout instance */
  create(options: CheckoutOptions): PBCheckout {
    return new PBCheckout(options);
  },
  
  /** Open checkout directly */
  open(options: CheckoutOptions): PBCheckout {
    const checkout = new PBCheckout(options);
    checkout.open();
    return checkout;
  },
  
  /** Create payment button */
  createButton(element: HTMLElement, options: CheckoutOptions): PBPaymentButton {
    return new PBPaymentButton(element, options);
  },
  
  /** Version */
  version: '1.0.0',
};

// ============================================================================
// Initialize on DOM Ready
// ============================================================================

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFromDataAttributes);
  } else {
    initializeFromDataAttributes();
  }
}

// ============================================================================
// Exports
// ============================================================================

export { PBCheckout, PBPaymentButton, PBCheckoutAPI };
export type { CheckoutOptions, CheckoutResult };
export default PBCheckoutAPI;

// Make available globally
if (typeof window !== 'undefined') {
  (window as unknown as { PBCheckout: typeof PBCheckoutAPI }).PBCheckout = PBCheckoutAPI;
}
