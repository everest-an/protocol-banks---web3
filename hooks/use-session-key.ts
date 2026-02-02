"use client";

/**
 * useSessionKey Hook
 * React hook for managing AI Agent session keys
 */

import { useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import {
  SessionKeyDetails,
  UsageRecord,
  CreateSessionKeyRequest,
  SUPPORTED_CHAINS,
  getChainConfig,
} from "@/types/session-key";
import {
  SessionKeyService,
  createSessionKeyService,
} from "@/lib/services/session-key-service";

interface UseSessionKeyOptions {
  chainId?: number;
  autoFetch?: boolean;
}

interface UseSessionKeyReturn {
  // State
  sessions: SessionKeyDetails[];
  currentSession: SessionKeyDetails | null;
  usageHistory: UsageRecord[];
  isLoading: boolean;
  error: string | null;

  // Actions
  createSession: (config: Omit<CreateSessionKeyRequest, "chainId">) => Promise<string | null>;
  fetchSessions: () => Promise<void>;
  fetchSessionDetails: (sessionId: string) => Promise<void>;
  freezeSession: (sessionId: string, reason: string) => Promise<boolean>;
  unfreezeSession: (sessionId: string) => Promise<boolean>;
  revokeSession: (sessionId: string) => Promise<boolean>;
  topUpBudget: (sessionId: string, additionalEth: string) => Promise<boolean>;
  
  // Utilities
  formatBudget: (wei: bigint) => string;
  supportedChains: typeof SUPPORTED_CHAINS;
  switchChain: (chainId: number) => void;
  currentChainId: number;
}

export function useSessionKey(options: UseSessionKeyOptions = {}): UseSessionKeyReturn {
  const { chainId: initialChainId = 8453, autoFetch = true } = options;

  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  const [sessions, setSessions] = useState<SessionKeyDetails[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionKeyDetails | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChainId, setCurrentChainId] = useState(initialChainId);

  // Get ethers signer from wallet provider
  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (!walletProvider) return null;
    try {
      const provider = new ethers.BrowserProvider(walletProvider as any);
      return await provider.getSigner();
    } catch (err) {
      console.error("[useSessionKey] Failed to get signer:", err);
      return null;
    }
  }, [walletProvider]);

  // Fetch all sessions for the connected wallet
  const fetchSessions = useCallback(async () => {
    if (!address || !isConnected) {
      setSessions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/session-keys?owner=${address}&chainId=${currentChainId}`
      );
      const data = await response.json();

      if (data.success) {
        // Convert string values back to BigInt where needed
        const parsedSessions = data.sessions.map((s: any) => ({
          ...s,
          maxBudget: BigInt(s.maxBudget),
          usedBudget: BigInt(s.usedBudget),
          remainingBudget: BigInt(s.remainingBudget),
          maxSingleTx: BigInt(s.maxSingleTx),
        }));
        setSessions(parsedSessions);
      } else {
        setError(data.error || "Failed to fetch sessions");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch sessions");
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected, currentChainId]);

  // Fetch details for a specific session
  const fetchSessionDetails = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/session-keys/${sessionId}?chainId=${currentChainId}`
      );
      const data = await response.json();

      if (data.success) {
        const session = {
          ...data.session,
          maxBudget: BigInt(data.session.maxBudget),
          usedBudget: BigInt(data.session.usedBudget),
          remainingBudget: BigInt(data.session.remainingBudget),
          maxSingleTx: BigInt(data.session.maxSingleTx),
        };
        setCurrentSession(session);

        const history = data.usageHistory.map((r: any) => ({
          ...r,
          amount: BigInt(r.amount),
        }));
        setUsageHistory(history);
      } else {
        setError(data.error || "Failed to fetch session details");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch session details");
    } finally {
      setIsLoading(false);
    }
  }, [currentChainId]);

  // Create a new session key
  const createSession = useCallback(async (
    config: Omit<CreateSessionKeyRequest, "chainId">
  ): Promise<string | null> => {
    const signer = await getSigner();
    if (!signer) {
      setError("Wallet not connected");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = createSessionKeyService(currentChainId, signer);
      
      const result = await service.createSessionKey({
        sessionKey: config.sessionKeyAddress,
        maxBudget: SessionKeyService.parseEth(config.maxBudgetEth),
        maxSingleTx: SessionKeyService.parseEth(config.maxSingleTxEth),
        duration: config.durationHours * 3600,
        allowedTokens: config.allowedTokens || [],
        allowedTargets: config.allowedTargets || [],
      });

      // Refresh sessions list
      await fetchSessions();

      return result.sessionId;
    } catch (err: any) {
      setError(err.message || "Failed to create session");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, currentChainId, fetchSessions]);

  // Freeze a session
  const freezeSession = useCallback(async (
    sessionId: string,
    reason: string
  ): Promise<boolean> => {
    const signer = await getSigner();
    if (!signer) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = createSessionKeyService(currentChainId, signer);
      await service.freezeSessionKey(sessionId, reason);
      await fetchSessions();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to freeze session");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, currentChainId, fetchSessions]);

  // Unfreeze a session
  const unfreezeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const signer = await getSigner();
    if (!signer) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = createSessionKeyService(currentChainId, signer);
      await service.unfreezeSessionKey(sessionId);
      await fetchSessions();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to unfreeze session");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, currentChainId, fetchSessions]);

  // Revoke a session
  const revokeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    const signer = await getSigner();
    if (!signer) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = createSessionKeyService(currentChainId, signer);
      await service.revokeSessionKey(sessionId);
      await fetchSessions();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to revoke session");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, currentChainId, fetchSessions]);

  // Top up budget
  const topUpBudget = useCallback(async (
    sessionId: string,
    additionalEth: string
  ): Promise<boolean> => {
    const signer = await getSigner();
    if (!signer) {
      setError("Wallet not connected");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const service = createSessionKeyService(currentChainId, signer);
      await service.topUpBudget(sessionId, SessionKeyService.parseEth(additionalEth));
      await fetchSessions();
      return true;
    } catch (err: any) {
      setError(err.message || "Failed to top up budget");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getSigner, currentChainId, fetchSessions]);

  // Format budget for display
  const formatBudget = useCallback((wei: bigint): string => {
    return SessionKeyService.formatEth(wei);
  }, []);

  // Switch chain
  const switchChain = useCallback((chainId: number) => {
    if (getChainConfig(chainId)) {
      setCurrentChainId(chainId);
      setSessions([]);
      setCurrentSession(null);
      setUsageHistory([]);
    }
  }, []);

  // Auto-fetch sessions when wallet connects
  useEffect(() => {
    if (autoFetch && isConnected && address) {
      fetchSessions();
    }
  }, [autoFetch, isConnected, address, currentChainId, fetchSessions]);

  return {
    sessions,
    currentSession,
    usageHistory,
    isLoading,
    error,
    createSession,
    fetchSessions,
    fetchSessionDetails,
    freezeSession,
    unfreezeSession,
    revokeSession,
    topUpBudget,
    formatBudget,
    supportedChains: SUPPORTED_CHAINS,
    switchChain,
    currentChainId,
  };
}
