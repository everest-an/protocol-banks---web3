/**
 * @protocolbanks/react - Chain Selector Component
 */

import React from 'react';
import type { ChainId } from '@protocolbanks/sdk';
import type { ChainSelectorProps } from '../types';

// Chain metadata
const CHAINS: Record<ChainId, { name: string; icon: string }> = {
  1: { name: 'Ethereum', icon: '⟠' },
  137: { name: 'Polygon', icon: '⬡' },
  8453: { name: 'Base', icon: '🔵' },
  42161: { name: 'Arbitrum', icon: '🔷' },
  10: { name: 'Optimism', icon: '🔴' },
  56: { name: 'BSC', icon: '🟡' },
  solana: { name: 'Solana', icon: '◎' },
  bitcoin: { name: 'Bitcoin', icon: '₿' },
};

const DEFAULT_CHAINS: ChainId[] = [1, 137, 8453, 42161, 10, 56];

export function ChainSelector({
  value,
  allowedChains = DEFAULT_CHAINS,
  onChange,
  disabled = false,
  className = '',
}: ChainSelectorProps): JSX.Element {
  return (
    <div className={`pb-selector ${className}`}>
      <label className="pb-selector-label">Select Network</label>
      <div className="pb-selector-grid">
        {allowedChains.map((chainId) => {
          const chain = CHAINS[chainId];
          if (!chain) return null;
          
          return (
            <button
              key={chainId}
              type="button"
              className={`pb-selector-option ${value === chainId ? 'selected' : ''}`}
              onClick={() => onChange(chainId)}
              disabled={disabled}
            >
              <div className="pb-selector-option-icon">{chain.icon}</div>
              <div className="pb-selector-option-name">{chain.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
