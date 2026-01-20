/**
 * @protocolbanks/react - Payment Button Component
 */

import React, { useCallback } from 'react';
import type { PaymentButtonProps } from '../types';
import { useCheckoutContext } from '../context/CheckoutContext';

// Button size styles
const SIZES = {
  sm: { padding: '8px 16px', fontSize: '14px' },
  md: { padding: '12px 24px', fontSize: '16px' },
  lg: { padding: '16px 32px', fontSize: '18px' },
};

// Button variant classes
const VARIANTS = {
  default: 'pb-btn pb-btn-primary',
  minimal: 'pb-btn pb-btn-outline',
  branded: 'pb-btn pb-btn-primary',
  outline: 'pb-btn pb-btn-outline',
};

export function PaymentButton({
  amount,
  recipientAddress,
  token = 'USDC',
  chain,
  allowedChains,
  allowedTokens,
  orderId,
  memo,
  variant = 'default',
  size = 'md',
  children,
  disabled = false,
  loading = false,
  onSuccess,
  onError,
  className = '',
  style,
}: PaymentButtonProps): JSX.Element {
  const { openCheckout } = useCheckoutContext();

  const handleClick = useCallback(() => {
    openCheckout({
      amount,
      recipientAddress,
      token,
      chain,
      allowedChains,
      allowedTokens,
      orderId,
      memo,
    });
  }, [amount, recipientAddress, token, chain, allowedChains, allowedTokens, orderId, memo, openCheckout]);

  const sizeStyle = SIZES[size];
  const variantClass = VARIANTS[variant];

  return (
    <button
      type="button"
      className={`${variantClass} ${className}`}
      style={{ ...sizeStyle, ...style }}
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {loading && <span className="pb-spinner" />}
      {children || `Pay ${amount} ${token}`}
    </button>
  );
}
