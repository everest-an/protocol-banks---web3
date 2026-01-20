/**
 * @protocolbanks/react - useWallet Hook
 * 
 * Wallet connection hook supporting MetaMask, WalletConnect, and Phantom
 */

import { useState, useCallback, useEffect } from 'react';
import type { ChainId } from '@protocolbanks/sdk';
import type { UseWalletReturn } from '../types';

// Chain ID mapping
const CHAIN_IDS: Record<number, ChainId> = {
  1: 1,       // Ethereum
  137: 137,   // Polygon
  8453: 8453, // Base
  42161: 42161, // Arbitrum
  10: 10,     // Optimism
  56: 56,     // BSC
};

/**
 * Hook for wallet connection and management
 */
export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<ChainId | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!address;

  // Check for existing connection on mount
  useEffect(() => {
    checkConnection();
    setupListeners();
    return () => removeListeners();
  }, []);

  const checkConnection = async () => {
    if (typeof window === 'undefined') return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    try {
      const accounts = await eth.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        const chainIdHex = await eth.request({ method: 'eth_chainId' });
        const numericChainId = parseInt(chainIdHex, 16);
        setChainId(CHAIN_IDS[numericChainId] || null);
      }
    } catch (err) {
      console.error('Failed to check connection:', err);
    }
  };

  const setupListeners = () => {
    if (typeof window === 'undefined') return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    eth.on('accountsChanged', handleAccountsChanged);
    eth.on('chainChanged', handleChainChanged);
  };

  const removeListeners = () => {
    if (typeof window === 'undefined') return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    eth.removeListener('accountsChanged', handleAccountsChanged);
    eth.removeListener('chainChanged', handleChainChanged);
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAddress(null);
      setChainId(null);
    } else {
      setAddress(accounts[0]);
    }
  };

  const handleChainChanged = (chainIdHex: string) => {
    const numericChainId = parseInt(chainIdHex, 16);
    setChainId(CHAIN_IDS[numericChainId] || null);
  };

  const connect = useCallback(async (walletType: 'metamask' | 'walletconnect' | 'phantom' = 'metamask') => {
    setIsConnecting(true);
    setError(null);

    try {
      if (walletType === 'metamask') {
        await connectMetaMask();
      } else if (walletType === 'phantom') {
        await connectPhantom();
      } else {
        throw new Error('WalletConnect not yet implemented');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectMetaMask = async () => {
    if (typeof window === 'undefined') throw new Error('Window not available');
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('MetaMask not installed');

    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    setAddress(accounts[0]);

    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    const numericChainId = parseInt(chainIdHex, 16);
    setChainId(CHAIN_IDS[numericChainId] || null);
  };

  const connectPhantom = async () => {
    if (typeof window === 'undefined') throw new Error('Window not available');
    const phantom = (window as any).phantom?.solana;
    if (!phantom) throw new Error('Phantom not installed');

    const response = await phantom.connect();
    setAddress(response.publicKey.toString());
    setChainId('solana');
  };

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setError(null);
  }, []);

  const switchChain = useCallback(async (targetChainId: ChainId) => {
    if (typeof window === 'undefined') throw new Error('Window not available');
    if (targetChainId === 'solana' || targetChainId === 'bitcoin') {
      throw new Error('Cannot switch to non-EVM chain');
    }

    const eth = (window as any).ethereum;
    if (!eth) throw new Error('MetaMask not installed');

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
      setChainId(targetChainId);
    } catch (err: any) {
      if (err.code === 4902) {
        throw new Error('Chain not added to wallet');
      }
      throw err;
    }
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!address) throw new Error('Wallet not connected');
    if (typeof window === 'undefined') throw new Error('Window not available');

    const eth = (window as any).ethereum;
    if (!eth) throw new Error('MetaMask not installed');

    const signature = await eth.request({
      method: 'personal_sign',
      params: [message, address],
    });
    return signature;
  }, [address]);

  return {
    address,
    isConnected,
    isConnecting,
    chainId,
    connect,
    disconnect,
    switchChain,
    signMessage,
    error,
  };
}
