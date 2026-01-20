/**
 * @protocolbanks/react - Checkout Modal Component
 */

import React, { useEffect, useCallback } from 'react';
import { useCheckoutContext } from '../context/CheckoutContext';
import { CheckoutWidget } from './CheckoutWidget';

/**
 * Modal wrapper for CheckoutWidget
 * Automatically renders when checkout is opened via context
 */
export function CheckoutModal(): JSX.Element | null {
  const { isOpen, currentConfig, closeCheckout } = useCheckoutContext();

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeCheckout();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeCheckout]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeCheckout();
    }
  }, [closeCheckout]);

  if (!isOpen || !currentConfig) return null;

  return (
    <div className="pb-checkout-overlay" onClick={handleOverlayClick}>
      <div className="pb-checkout-modal">
        <CheckoutWidget
          amount={currentConfig.amount}
          recipientAddress={currentConfig.recipientAddress}
          token={currentConfig.token}
          chain={currentConfig.chain}
          allowedChains={currentConfig.allowedChains}
          allowedTokens={currentConfig.allowedTokens}
          orderId={currentConfig.orderId}
          memo={currentConfig.memo}
          onClose={closeCheckout}
        />
      </div>
    </div>
  );
}
