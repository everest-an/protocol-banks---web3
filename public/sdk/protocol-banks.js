/**
 * Protocol Banks Payment SDK
 * 
 * Embed payment buttons and checkout forms on any website.
 * 
 * Usage:
 *   <script src="https://protocol-banks.vercel.app/sdk/protocol-banks.js"></script>
 *   <script>
 *     ProtocolBanks.init({
 *       merchantName: 'My Store',
 *       defaultToken: 'USDC'
 *     });
 *     
 *     // Create a payment button
 *     ProtocolBanks.createButton({
 *       container: '#pay-button',
 *       to: '0x...',
 *       amount: '10.00',
 *       label: 'Pay $10'
 *     });
 *   </script>
 */

(function(window, document) {
  'use strict';

  const SDK_VERSION = '1.0.0';
  const BASE_URL = window.PROTOCOL_BANKS_URL || 'https://protocol-banks.vercel.app';
  
  // Configuration
  let config = {
    merchantName: '',
    defaultToken: 'USDC',
    theme: 'light',
    debug: false
  };

  // Utility functions
  function log(...args) {
    if (config.debug) {
      console.log('[ProtocolBanks SDK]', ...args);
    }
  }

  function validateAddress(address) {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  function createIframe(url, options = {}) {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.border = 'none';
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '500px';
    iframe.style.maxWidth = options.maxWidth || '400px';
    iframe.style.borderRadius = '12px';
    iframe.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    iframe.allow = 'payment; clipboard-write';
    return iframe;
  }

  // Payment modal
  function openModal(options) {
    const overlay = document.createElement('div');
    overlay.id = 'protocol-banks-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      backdrop-filter: blur(4px);
    `;

    const params = new URLSearchParams({
      to: options.to,
      token: options.token || config.defaultToken,
      theme: options.theme || config.theme
    });

    if (options.amount) params.set('amount', options.amount);
    if (options.merchantName || config.merchantName) {
      params.set('merchant', options.merchantName || config.merchantName);
    }
    if (options.description) params.set('desc', options.description);
    if (options.label) params.set('label', options.label);
    if (options.allowCustomAmount) params.set('custom', 'true');

    const iframe = createIframe(`${BASE_URL}/embed/pay?${params.toString()}`, {
      width: '100%',
      maxWidth: '420px',
      height: '600px'
    });

    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      max-width: 420px;
      width: 90%;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
      position: absolute;
      top: -40px;
      right: 0;
      background: white;
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    closeBtn.onclick = () => closeModal();

    container.appendChild(closeBtn);
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

    // Close on escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    log('Modal opened', options);
    return overlay;
  }

  function closeModal() {
    const overlay = document.getElementById('protocol-banks-overlay');
    if (overlay) {
      overlay.remove();
      log('Modal closed');
    }
  }

  // Message handler for iframe communication
  function handleMessage(event) {
    if (event.origin !== BASE_URL) return;
    
    const { type, ...data } = event.data || {};
    
    switch (type) {
      case 'PROTOCOL_BANKS_PAYMENT_SUCCESS':
        log('Payment success', data);
        closeModal();
        if (typeof config.onSuccess === 'function') {
          config.onSuccess(data);
        }
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('protocolbanks:payment:success', { detail: data }));
        break;
        
      case 'PROTOCOL_BANKS_PAYMENT_ERROR':
        log('Payment error', data);
        if (typeof config.onError === 'function') {
          config.onError(data);
        }
        window.dispatchEvent(new CustomEvent('protocolbanks:payment:error', { detail: data }));
        break;
    }
  }

  // SDK API
  const ProtocolBanks = {
    version: SDK_VERSION,

    /**
     * Initialize the SDK
     */
    init: function(options = {}) {
      config = { ...config, ...options };
      window.addEventListener('message', handleMessage);
      log('SDK initialized', config);
      return this;
    },

    /**
     * Create a payment button
     */
    createButton: function(options) {
      if (!options.to || !validateAddress(options.to)) {
        console.error('[ProtocolBanks] Invalid recipient address');
        return null;
      }

      const container = typeof options.container === 'string' 
        ? document.querySelector(options.container)
        : options.container;

      if (!container) {
        console.error('[ProtocolBanks] Container not found:', options.container);
        return null;
      }

      const button = document.createElement('button');
      button.className = 'protocol-banks-button';
      button.innerHTML = options.label || `Pay ${options.amount ? '$' + options.amount : ''}`;
      button.style.cssText = options.style || `
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: transform 0.1s, box-shadow 0.2s;
      `;

      button.onmouseenter = () => {
        button.style.transform = 'translateY(-1px)';
        button.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
      };
      button.onmouseleave = () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = 'none';
      };

      button.onclick = () => this.openPayment(options);

      container.appendChild(button);
      log('Button created', options);
      return button;
    },

    /**
     * Open payment modal
     */
    openPayment: function(options) {
      if (!options.to || !validateAddress(options.to)) {
        console.error('[ProtocolBanks] Invalid recipient address');
        return;
      }
      return openModal(options);
    },

    /**
     * Close payment modal
     */
    closePayment: closeModal,

    /**
     * Create an embedded payment form
     */
    embed: function(options) {
      const container = typeof options.container === 'string'
        ? document.querySelector(options.container)
        : options.container;

      if (!container) {
        console.error('[ProtocolBanks] Container not found:', options.container);
        return null;
      }

      const params = new URLSearchParams({
        to: options.to,
        token: options.token || config.defaultToken,
        theme: options.theme || config.theme
      });

      if (options.amount) params.set('amount', options.amount);
      if (options.merchantName || config.merchantName) {
        params.set('merchant', options.merchantName || config.merchantName);
      }
      if (options.description) params.set('desc', options.description);
      if (options.allowCustomAmount) params.set('custom', 'true');

      const iframe = createIframe(`${BASE_URL}/embed/pay?${params.toString()}`, {
        width: options.width || '100%',
        height: options.height || '500px',
        maxWidth: options.maxWidth || '400px'
      });

      container.appendChild(iframe);
      log('Embedded form created', options);
      return iframe;
    },

    /**
     * Generate a payment link
     */
    createPaymentLink: function(options) {
      const params = new URLSearchParams({
        to: options.to,
        token: options.token || config.defaultToken
      });

      if (options.amount) params.set('amount', options.amount);
      if (options.merchantName) params.set('merchant', options.merchantName);
      if (options.description) params.set('desc', options.description);

      return `${BASE_URL}/pay?${params.toString()}`;
    }
  };

  // Expose to global scope
  window.ProtocolBanks = ProtocolBanks;

  // Auto-init if data attributes found
  document.addEventListener('DOMContentLoaded', function() {
    const autoInitButtons = document.querySelectorAll('[data-protocol-banks-button]');
    autoInitButtons.forEach(el => {
      const options = {
        container: el,
        to: el.dataset.to,
        amount: el.dataset.amount,
        token: el.dataset.token,
        label: el.dataset.label,
        merchantName: el.dataset.merchant
      };
      if (options.to) {
        ProtocolBanks.createButton(options);
      }
    });
  });

  log('SDK loaded', SDK_VERSION);

})(window, document);
