/**
 * @protocolbanks/react - Checkout Context Provider
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { ProtocolBanksClient, type CheckoutConfig, type ChainId, type TokenSymbol } from '@protocolbanks/sdk';
import type { CheckoutContextValue, CheckoutProviderProps } from '../types';
import { defaultTheme, mergeTheme, injectStyles } from '../theme';

// ============================================================================
// Context
// ============================================================================

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function CheckoutProvider({
  apiKey,
  apiSecret,
  environment = 'production',
  theme: customTheme,
  locale = 'en',
  children,
}: CheckoutProviderProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<CheckoutConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Merge theme
  const theme = useMemo(() => mergeTheme(customTheme), [customTheme]);

  // Initialize SDK client
  const client = useMemo(() => {
    if (!apiKey) return null;
    return new ProtocolBanksClient({
      apiKey,
      apiSecret: apiSecret || '',
      environment,
    });
  }, [apiKey, apiSecret, environment]);

  // Inject styles on mount
  useEffect(() => {
    injectStyles(theme);
  }, [theme]);

  // Open checkout
  const openCheckout = useCallback((config: CheckoutConfig) => {
    setCurrentConfig(config);
    setError(null);
    setIsOpen(true);
  }, []);

  // Close checkout
  const closeCheckout = useCallback(() => {
    setIsOpen(false);
    setCurrentConfig(null);
    setError(null);
    setIsLoading(false);
  }, []);

  // Get supported chains
  const getSupportedChains = useCallback((): ChainId[] => {
    if (!client) return [];
    return client.links.getSupportedChains('USDC');
  }, [client]);

  // Get supported tokens for chain
  const getSupportedTokens = useCallback((chain: ChainId): TokenSymbol[] => {
    if (!client) return [];
    return client.links.getSupportedTokens(chain);
  }, [client]);

  // Context value
  const value = useMemo<CheckoutContextValue>(() => ({
    apiKey,
    environment,
    theme,
    locale,
    isOpen,
    currentConfig,
    isLoading,
    error,
    openCheckout,
    closeCheckout,
    getSupportedChains,
    getSupportedTokens,
  }), [
    apiKey,
    environment,
    theme,
    locale,
    isOpen,
    currentConfig,
    isLoading,
    error,
    openCheckout,
    closeCheckout,
    getSupportedChains,
    getSupportedTokens,
  ]);

  return (
    <CheckoutContext.Provider value={value}>
      {children}
    </CheckoutContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useCheckoutContext(): CheckoutContextValue {
  const context = useContext(CheckoutContext);
  if (!context) {
    throw new Error('useCheckoutContext must be used within a CheckoutProvider');
  }
  return context;
}

export { CheckoutContext };
