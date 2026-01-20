/**
 * @protocolbanks/react - Checkout Widget Component
 */

import React, { useState, useCallback, useReducer, useEffect } from 'react';
import type { ChainId, TokenSymbol, CheckoutResult } from '@protocolbanks/sdk';
import type { CheckoutWidgetProps, PaymentState, PaymentAction } from '../types';
import { useCheckoutContext } from '../context/CheckoutContext';
import { useWallet } from '../hooks/useWallet';
import { ChainSelector } from './ChainSelector';
import { TokenSelector } from './TokenSelector';

// Initial state
const initialState: PaymentState = {
  step: 'select',
  selectedChain: null,
  selectedToken: null,
  walletAddress: null,
  transactionHash: null,
  error: null,
};

// Reducer
function paymentReducer(state: PaymentState, action: PaymentAction): PaymentState {
  switch (action.type) {
    case 'SELECT_CHAIN':
      return { ...state, selectedChain: action.chain };
    case 'SELECT_TOKEN':
      return { ...state, selectedToken: action.token };
    case 'CONNECT_WALLET':
      return { ...state, walletAddress: action.address, step: 'confirm' };
    case 'START_PAYMENT':
      return { ...state, step: 'processing', error: null };
    case 'PAYMENT_SUCCESS':
      return { ...state, step: 'success', transactionHash: action.hash };
    case 'PAYMENT_ERROR':
      return { ...state, step: 'error', error: action.error };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function CheckoutWidget({
  amount,
  recipientAddress,
  token: defaultToken = 'USDC',
  chain: defaultChain,
  allowedChains,
  allowedTokens,
  orderId,
  memo,
  onSuccess,
  onError,
  onClose,
  className = '',
  style,
}: CheckoutWidgetProps): JSX.Element {
  const { theme, locale } = useCheckoutContext();
  const wallet = useWallet();
  const [state, dispatch] = useReducer(paymentReducer, {
    ...initialState,
    selectedChain: defaultChain || null,
    selectedToken: defaultToken,
  });

  // Sync wallet connection
  useEffect(() => {
    if (wallet.isConnected && wallet.address && state.step === 'connect') {
      dispatch({ type: 'CONNECT_WALLET', address: wallet.address });
    }
  }, [wallet.isConnected, wallet.address, state.step]);

  const handleChainSelect = useCallback((chain: ChainId) => {
    dispatch({ type: 'SELECT_CHAIN', chain });
  }, []);

  const handleTokenSelect = useCallback((token: TokenSymbol) => {
    dispatch({ type: 'SELECT_TOKEN', token });
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      await wallet.connect('metamask');
    } catch (err) {
      dispatch({ type: 'PAYMENT_ERROR', error: 'Failed to connect wallet' });
    }
  }, [wallet]);

  const handlePay = useCallback(async () => {
    if (!wallet.address || !state.selectedChain || !state.selectedToken) return;
    
    dispatch({ type: 'START_PAYMENT' });
    
    try {
      // Simulate payment (in real implementation, this would call the SDK)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockHash = '0x' + Math.random().toString(16).slice(2, 66);
      dispatch({ type: 'PAYMENT_SUCCESS', hash: mockHash });
      
      const result: CheckoutResult = {
        success: true,
        paymentId: 'pay_' + Date.now(),
        transactionHash: mockHash,
        chain: state.selectedChain,
        token: state.selectedToken,
        amount,
        timestamp: new Date(),
      };
      
      onSuccess?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      dispatch({ type: 'PAYMENT_ERROR', error: message });
      onError?.(err instanceof Error ? err : new Error(message));
    }
  }, [wallet.address, state.selectedChain, state.selectedToken, amount, onSuccess, onError]);

  const handleClose = useCallback(() => {
    dispatch({ type: 'RESET' });
    onClose?.();
  }, [onClose]);

  // Render based on step
  return (
    <div className={`pb-checkout ${className}`} style={style}>
      <div className="pb-checkout-header">
        <h2 className="pb-checkout-title">Checkout</h2>
        <button className="pb-checkout-close" onClick={handleClose}>✕</button>
      </div>
      
      <div className="pb-checkout-body">
        {/* Amount display */}
        <div className="pb-checkout-amount">
          <div className="pb-checkout-amount-value">{amount}</div>
          <div className="pb-checkout-amount-token">{state.selectedToken || defaultToken}</div>
        </div>

        {/* Selection step */}
        {(state.step === 'select' || state.step === 'connect') && (
          <>
            <ChainSelector
              value={state.selectedChain || undefined}
              allowedChains={allowedChains}
              onChange={handleChainSelect}
            />
            
            <TokenSelector
              value={state.selectedToken || undefined}
              chain={state.selectedChain || undefined}
              allowedTokens={allowedTokens}
              onChange={handleTokenSelect}
            />
            
            {!wallet.isConnected ? (
              <button
                className="pb-btn pb-btn-primary"
                onClick={handleConnect}
                disabled={!state.selectedChain || !state.selectedToken || wallet.isConnecting}
              >
                {wallet.isConnecting ? (
                  <><span className="pb-spinner" /> Connecting...</>
                ) : (
                  'Connect Wallet'
                )}
              </button>
            ) : (
              <button
                className="pb-btn pb-btn-primary"
                onClick={handlePay}
                disabled={!state.selectedChain || !state.selectedToken}
              >
                Pay {amount} {state.selectedToken}
              </button>
            )}
          </>
        )}

        {/* Processing step */}
        {state.step === 'processing' && (
          <div className="pb-status">
            <div className="pb-status-icon">
              <span className="pb-spinner" style={{ width: 40, height: 40 }} />
            </div>
            <div className="pb-status-title">Processing Payment</div>
            <div className="pb-status-message">Please confirm in your wallet...</div>
          </div>
        )}

        {/* Success step */}
        {state.step === 'success' && (
          <div className="pb-status">
            <div className="pb-status-icon success">✓</div>
            <div className="pb-status-title">Payment Successful!</div>
            <div className="pb-status-message">Your payment has been confirmed.</div>
            {state.transactionHash && (
              <a className="pb-tx-link" href={`https://etherscan.io/tx/${state.transactionHash}`} target="_blank" rel="noopener noreferrer">
                View Transaction ↗
              </a>
            )}
            <button className="pb-btn pb-btn-outline" onClick={handleClose} style={{ marginTop: 16 }}>
              Close
            </button>
          </div>
        )}

        {/* Error step */}
        {state.step === 'error' && (
          <div className="pb-status">
            <div className="pb-status-icon error">✕</div>
            <div className="pb-status-title">Payment Failed</div>
            <div className="pb-status-message">{state.error}</div>
            <button className="pb-btn pb-btn-primary" onClick={() => dispatch({ type: 'RESET' })} style={{ marginTop: 16 }}>
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
