/**
 * @protocolbanks/react - useCheckout Hook
 */

import { useCallback } from 'react';
import type { CheckoutConfig } from '@protocolbanks/sdk';
import { useCheckoutContext } from '../context/CheckoutContext';
import type { UseCheckoutReturn } from '../types';

/**
 * Hook for programmatic checkout control
 * 
 * @example
 * ```tsx
 * const { openCheckout, closeCheckout, isOpen } = useCheckout();
 * 
 * const handlePay = () => {
 *   openCheckout({
 *     amount: '100',
 *     recipientAddress: '0x1234...',
 *     token: 'USDC',
 *   });
 * };
 * ```
 */
export function useCheckout(): UseCheckoutReturn {
  const { openCheckout, closeCheckout, isOpen, isLoading, error } = useCheckoutContext();

  const open = useCallback((config: CheckoutConfig) => {
    openCheckout(config);
  }, [openCheckout]);

  const close = useCallback(() => {
    closeCheckout();
  }, [closeCheckout]);

  return {
    openCheckout: open,
    closeCheckout: close,
    isOpen,
    isLoading,
    error,
  };
}
