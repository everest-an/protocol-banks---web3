/**
 * 批量转账集成 Hook
 * 封装公开批量转账合约的调用逻辑
 */

import { useWalletClient, usePublicClient, useChainId } from 'wagmi';
import { useState, useCallback } from 'react';
import { publicBatchTransferService, type BatchRecipient } from '@/lib/services/public-batch-transfer-service';
import type { Address } from 'viem';

export interface UseBatchTransferResult {
  executeBatchTransfer: (recipients: BatchRecipient[], tokenSymbol: string) => Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }>;
  isProcessing: boolean;
  isApproving: boolean;
  error: string | null;
}

export function useBatchTransfer(): UseBatchTransferResult {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeBatchTransfer = useCallback(
    async (recipients: BatchRecipient[], tokenSymbol: string = 'USDT') => {
      setError(null);
      setIsProcessing(true);

      try {
        // 验证客户端
        if (!walletClient || !publicClient) {
          throw new Error('Wallet not connected');
        }

        // 检查链是否支持
        if (!publicBatchTransferService.isChainSupported(chainId)) {
          throw new Error(`Batch transfer not supported on chain ${chainId}`);
        }

        console.log('[useBatchTransfer] Starting batch transfer...');
        console.log('  Recipients:', recipients.length);
        console.log('  Token:', tokenSymbol);
        console.log('  Chain:', chainId);

        // 执行批量转账
        setIsApproving(true);
        const result = await publicBatchTransferService.batchTransfer(
          walletClient,
          publicClient,
          recipients,
          tokenSymbol,
          chainId
        );
        setIsApproving(false);

        if (!result.success) {
          throw new Error(result.errorMessage || 'Batch transfer failed');
        }

        console.log('[useBatchTransfer] Batch transfer successful:', result.txHash);

        return {
          success: true,
          txHash: result.txHash,
        };
      } catch (err: any) {
        console.error('[useBatchTransfer] Error:', err);
        const errorMessage = err.message || 'Batch transfer failed';
        setError(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsProcessing(false);
        setIsApproving(false);
      }
    },
    [walletClient, publicClient, chainId]
  );

  return {
    executeBatchTransfer,
    isProcessing,
    isApproving,
    error,
  };
}
