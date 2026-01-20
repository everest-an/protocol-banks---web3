/**
 * ProtocolBanks Embed Code Generator
 * 
 * 生成可复制粘贴的 HTML 代码片段
 */

import type { CheckoutConfig, CheckoutTheme, TokenSymbol, ChainId } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface EmbedCodeOptions {
  /** API Key (required) */
  apiKey: string;
  /** Payment amount (required) */
  amount: string;
  /** Recipient address (required) */
  recipientAddress: string;
  /** Token symbol */
  token?: TokenSymbol;
  /** Chain ID */
  chain?: ChainId;
  /** Order ID */
  orderId?: string;
  /** Payment memo */
  memo?: string;
  /** Callback URL after payment */
  callbackUrl?: string;
  /** Webhook URL */
  webhookUrl?: string;
  /** Locale */
  locale?: string;
  /** Theme customization */
  theme?: CheckoutTheme;
  /** Button label */
  buttonLabel?: string;
  /** Button style */
  buttonStyle?: 'default' | 'minimal' | 'branded';
  /** Button size */
  buttonSize?: 'small' | 'medium' | 'large';
  /** Auto-open checkout */
  autoOpen?: boolean;
}

export interface GeneratedCode {
  /** Script tag embed code */
  script: string;
  /** Button embed code */
  button: string;
  /** Inline widget code */
  inline: string;
  /** React component code */
  react: string;
  /** Vue component code */
  vue: string;
}

// ============================================================================
// Code Generator
// ============================================================================

export class EmbedCodeGenerator {
  private readonly cdnUrl = 'https://sdk.protocolbanks.com/checkout.js';
  
  /**
   * Generate all embed code variants
   */
  generate(options: EmbedCodeOptions): GeneratedCode {
    return {
      script: this.generateScriptTag(options),
      button: this.generateButtonCode(options),
      inline: this.generateInlineWidget(options),
      react: this.generateReactCode(options),
      vue: this.generateVueCode(options),
    };
  }

  /**
   * Generate script tag embed code (simplest integration)
   */
  generateScriptTag(options: EmbedCodeOptions): string {
    const attrs = this.buildDataAttributes(options);
    return `<script src="${this.cdnUrl}"${attrs}></script>`;
  }
  
  /**
   * Generate button embed code
   */
  generateButtonCode(options: EmbedCodeOptions): string {
    const attrs = this.buildDataAttributes(options);
    const label = options.buttonLabel || `Pay ${options.amount} ${options.token || 'USDC'}`;
    const style = options.buttonStyle || 'default';
    const size = options.buttonSize || 'medium';
    
    return `<!-- ProtocolBanks Payment Button -->
<script src="${this.cdnUrl}"></script>
<button class="pb-pay-button"
        data-style="${style}"
        data-size="${size}"${attrs}>
  ${label}
</button>`;
  }
  
  /**
   * Generate inline widget code
   */
  generateInlineWidget(options: EmbedCodeOptions): string {
    const attrs = this.buildDataAttributes(options);
    
    return `<!-- ProtocolBanks Inline Checkout -->
<script src="${this.cdnUrl}"></script>
<div data-pb-checkout${attrs}
     data-label="${options.buttonLabel || 'Pay with Crypto'}">
</div>`;
  }
  
  /**
   * Generate React component code
   */
  generateReactCode(options: EmbedCodeOptions): string {
    const themeStr = options.theme 
      ? `\n        theme={${JSON.stringify(options.theme, null, 2).replace(/\n/g, '\n        ')}}` 
      : '';
    
    return `import { CheckoutProvider, PaymentButton } from '@protocolbanks/react';

function PaymentSection() {
  return (
    <CheckoutProvider apiKey="${options.apiKey}">
      <PaymentButton
        amount="${options.amount}"
        recipientAddress="${options.recipientAddress}"
        token="${options.token || 'USDC'}"${options.chain ? `\n        chain={${typeof options.chain === 'string' ? `"${options.chain}"` : options.chain}}` : ''}${options.orderId ? `\n        orderId="${options.orderId}"` : ''}${options.memo ? `\n        memo="${options.memo}"` : ''}${themeStr}
        onSuccess={(result) => console.log('Payment successful:', result)}
        onError={(error) => console.error('Payment failed:', error)}
      />
    </CheckoutProvider>
  );
}`;
  }

  /**
   * Generate Vue component code
   */
  generateVueCode(options: EmbedCodeOptions): string {
    return `<template>
  <div>
    <button @click="openCheckout" class="pay-button">
      Pay ${options.amount} ${options.token || 'USDC'}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const checkout = ref(null);

onMounted(() => {
  // Load ProtocolBanks SDK
  const script = document.createElement('script');
  script.src = '${this.cdnUrl}';
  script.onload = () => {
    checkout.value = window.PBCheckout.create({
      apiKey: '${options.apiKey}',
      amount: '${options.amount}',
      recipient: '${options.recipientAddress}',
      token: '${options.token || 'USDC'}',${options.chain ? `\n      chain: '${options.chain}',` : ''}${options.orderId ? `\n      orderId: '${options.orderId}',` : ''}
      onSuccess: (result) => console.log('Payment successful:', result),
      onError: (error) => console.error('Payment failed:', error),
    });
  };
  document.head.appendChild(script);
});

const openCheckout = () => {
  checkout.value?.open();
};
</script>`;
  }
  
  /**
   * Build data attributes string
   */
  private buildDataAttributes(options: EmbedCodeOptions): string {
    const attrs: string[] = [];
    
    attrs.push(`\n        data-api-key="${options.apiKey}"`);
    attrs.push(`\n        data-amount="${options.amount}"`);
    attrs.push(`\n        data-recipient="${options.recipientAddress}"`);
    
    if (options.token) attrs.push(`\n        data-token="${options.token}"`);
    if (options.chain) attrs.push(`\n        data-chain="${options.chain}"`);
    if (options.orderId) attrs.push(`\n        data-order-id="${options.orderId}"`);
    if (options.memo) attrs.push(`\n        data-memo="${options.memo}"`);
    if (options.callbackUrl) attrs.push(`\n        data-callback-url="${options.callbackUrl}"`);
    if (options.locale) attrs.push(`\n        data-locale="${options.locale}"`);
    if (options.autoOpen) attrs.push(`\n        data-auto-open="true"`);
    
    // Theme attributes
    if (options.theme) {
      const t = options.theme;
      if (t.primaryColor) attrs.push(`\n        data-primary-color="${t.primaryColor}"`);
      if (t.backgroundColor) attrs.push(`\n        data-background-color="${t.backgroundColor}"`);
      if (t.textColor) attrs.push(`\n        data-text-color="${t.textColor}"`);
      if (t.logo) attrs.push(`\n        data-logo="${t.logo}"`);
      if (t.companyName) attrs.push(`\n        data-company-name="${t.companyName}"`);
      if (t.darkMode) attrs.push(`\n        data-dark-mode="true"`);
    }
    
    return attrs.join('');
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate embed code for checkout
 */
export function generateEmbedCode(options: EmbedCodeOptions): GeneratedCode {
  const generator = new EmbedCodeGenerator();
  return generator.generate(options);
}

/**
 * Generate simple script tag
 */
export function generateScriptTag(options: EmbedCodeOptions): string {
  const generator = new EmbedCodeGenerator();
  return generator.generateScriptTag(options);
}

/**
 * Generate payment button code
 */
export function generateButtonCode(options: EmbedCodeOptions): string {
  const generator = new EmbedCodeGenerator();
  return generator.generateButtonCode(options);
}
