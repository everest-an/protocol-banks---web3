/**
 * @protocolbanks/react - Theme System
 */

import type { CheckoutTheme } from '@protocolbanks/sdk';

// ============================================================================
// Default Theme
// ============================================================================

export const defaultTheme: Required<CheckoutTheme> = {
  primaryColor: '#6366f1',      // Indigo
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderRadius: '12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  logo: '',
  companyName: '',
  darkMode: false,
};

export const darkTheme: Required<CheckoutTheme> = {
  primaryColor: '#818cf8',      // Lighter indigo for dark mode
  backgroundColor: '#1f2937',
  textColor: '#f9fafb',
  borderRadius: '12px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  logo: '',
  companyName: '',
  darkMode: true,
};

// ============================================================================
// Theme Utilities
// ============================================================================

export function mergeTheme(custom?: CheckoutTheme): Required<CheckoutTheme> {
  const base = custom?.darkMode ? darkTheme : defaultTheme;
  return { ...base, ...custom };
}

export function getCSSVariables(theme: Required<CheckoutTheme>): Record<string, string> {
  return {
    '--pb-primary': theme.primaryColor,
    '--pb-bg': theme.backgroundColor,
    '--pb-text': theme.textColor,
    '--pb-radius': theme.borderRadius,
    '--pb-font': theme.fontFamily,
    '--pb-primary-hover': adjustColor(theme.primaryColor, -10),
    '--pb-primary-light': adjustColor(theme.primaryColor, 40),
    '--pb-border': theme.darkMode ? '#374151' : '#e5e7eb',
    '--pb-muted': theme.darkMode ? '#9ca3af' : '#6b7280',
    '--pb-success': '#10b981',
    '--pb-error': '#ef4444',
    '--pb-warning': '#f59e0b',
  };
}

// ============================================================================
// Color Utilities
// ============================================================================

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// CSS Styles
// ============================================================================

export const baseStyles = `
  .pb-checkout {
    font-family: var(--pb-font);
    color: var(--pb-text);
    background: var(--pb-bg);
    border-radius: var(--pb-radius);
    box-sizing: border-box;
  }
  
  .pb-checkout * {
    box-sizing: border-box;
  }
  
  .pb-checkout-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }
  
  .pb-checkout-modal {
    background: var(--pb-bg);
    border-radius: var(--pb-radius);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-width: 420px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    animation: pb-slide-up 0.2s ease-out;
  }
  
  @keyframes pb-slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .pb-checkout-header {
    padding: 20px;
    border-bottom: 1px solid var(--pb-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .pb-checkout-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
  }
  
  .pb-checkout-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px;
    color: var(--pb-muted);
    border-radius: 8px;
    transition: background 0.15s;
  }
  
  .pb-checkout-close:hover {
    background: var(--pb-border);
  }
  
  .pb-checkout-body {
    padding: 20px;
  }
  
  .pb-checkout-amount {
    text-align: center;
    padding: 24px 0;
  }
  
  .pb-checkout-amount-value {
    font-size: 36px;
    font-weight: 700;
    color: var(--pb-text);
  }
  
  .pb-checkout-amount-token {
    font-size: 16px;
    color: var(--pb-muted);
    margin-top: 4px;
  }
  
  .pb-selector {
    margin-bottom: 16px;
  }
  
  .pb-selector-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--pb-muted);
    margin-bottom: 8px;
    display: block;
  }
  
  .pb-selector-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  
  .pb-selector-option {
    padding: 12px;
    border: 2px solid var(--pb-border);
    border-radius: 8px;
    background: var(--pb-bg);
    cursor: pointer;
    text-align: center;
    transition: all 0.15s;
  }
  
  .pb-selector-option:hover {
    border-color: var(--pb-primary-light);
  }
  
  .pb-selector-option.selected {
    border-color: var(--pb-primary);
    background: var(--pb-primary-light);
  }
  
  .pb-selector-option-icon {
    width: 24px;
    height: 24px;
    margin: 0 auto 4px;
  }
  
  .pb-selector-option-name {
    font-size: 12px;
    font-weight: 500;
  }
  
  .pb-btn {
    width: 100%;
    padding: 14px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  
  .pb-btn-primary {
    background: var(--pb-primary);
    color: white;
  }
  
  .pb-btn-primary:hover:not(:disabled) {
    background: var(--pb-primary-hover);
  }
  
  .pb-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .pb-btn-outline {
    background: transparent;
    border: 2px solid var(--pb-border);
    color: var(--pb-text);
  }
  
  .pb-btn-outline:hover:not(:disabled) {
    border-color: var(--pb-primary);
    color: var(--pb-primary);
  }
  
  .pb-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: pb-spin 0.8s linear infinite;
  }
  
  @keyframes pb-spin {
    to { transform: rotate(360deg); }
  }
  
  .pb-status {
    text-align: center;
    padding: 40px 20px;
  }
  
  .pb-status-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .pb-status-icon.success {
    background: rgba(16, 185, 129, 0.1);
    color: var(--pb-success);
  }
  
  .pb-status-icon.error {
    background: rgba(239, 68, 68, 0.1);
    color: var(--pb-error);
  }
  
  .pb-status-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .pb-status-message {
    font-size: 14px;
    color: var(--pb-muted);
  }
  
  .pb-tx-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--pb-primary);
    text-decoration: none;
    font-size: 14px;
    margin-top: 12px;
  }
  
  .pb-tx-link:hover {
    text-decoration: underline;
  }
  
  /* Responsive */
  @media (max-width: 480px) {
    .pb-checkout-modal {
      max-width: 100%;
      max-height: 100%;
      border-radius: 0;
      height: 100%;
    }
    
    .pb-selector-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;

// ============================================================================
// Inject Styles
// ============================================================================

let stylesInjected = false;

export function injectStyles(theme: Required<CheckoutTheme>): void {
  if (typeof document === 'undefined') return;
  
  if (!stylesInjected) {
    const style = document.createElement('style');
    style.id = 'pb-checkout-styles';
    style.textContent = baseStyles;
    document.head.appendChild(style);
    stylesInjected = true;
  }
  
  // Update CSS variables
  const vars = getCSSVariables(theme);
  const root = document.documentElement;
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
