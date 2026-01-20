/**
 * @protocolbanks/react - Token Selector Component
 */

import React from 'react';
import type { TokenSymbol, ChainId } from '@protocolbanks/sdk';
import type { TokenSelectorProps } from '../types';

// Token metadata
const TOKENS: Record<TokenSymbol, { name: string; icon: string }> = {
  USDC: { name: 'USDC', icon: '💵' },
  USDT: { name: 'USDT', icon: '💲' },
  DAI: { name: 'DAI', icon: '🟡' },
  ETH: { name: 'ETH', icon: '⟠' },
  MATIC: { name: 'MATIC', icon: '⬡' },
  BNB: { name: 'BNB', icon: '🟡' },
  SOL: { name: 'SOL', icon: '◎' },
  BTC: { name: 'BTC', icon: '₿' },
};

// Tokens available per chain
const CHAIN_TOKENS: Record<ChainId, TokenSymbol[]> = {
  1: ['USDC', 'USDT', 'DAI', 'ETH'],
  137: ['USDC', 'USDT', 'DAI', 'MATIC'],
  8453: ['USDC', 'ETH'],
  42161: ['USDC', 'USDT', 'ETH'],
  10: ['USDC', 'USDT', 'ETH'],
  56: ['USDC', 'USDT', 'BNB'],
  solana: ['USDC', 'SOL'],
  bitcoin: ['BTC'],
};

export function TokenSelector({
  value,
  chain,
  allowedTokens,
  onChange,
  disabled = false,
  className = '',
}: TokenSelectorProps): JSX.Element {
  // Get available tokens for current chain
  const chainTokens = chain ? CHAIN_TOKENS[chain] || [] : Object.keys(TOKENS) as TokenSymbol[];
  const availableTokens = allowedTokens 
    ? chainTokens.filter(t => allowedTokens.includes(t))
    : chainTokens;

  return (
    <div className={`pb-selector ${className}`}>
      <label className="pb-selector-label">Select Token</label>
      <div className="pb-selector-grid">
        {availableTokens.map((tokenSymbol) => {
          const token = TOKENS[tokenSymbol];
          if (!token) return null;
          
          return (
            <button
              key={tokenSymbol}
              type="button"
              className={`pb-selector-option ${value === tokenSymbol ? 'selected' : ''}`}
              onClick={() => onChange(tokenSymbol)}
              disabled={disabled}
            >
              <div className="pb-selector-option-icon">{token.icon}</div>
              <div className="pb-selector-option-name">{token.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
