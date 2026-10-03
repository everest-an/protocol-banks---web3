import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { authHeaders } from '@/lib/authenticated-fetch';
import { getTokenAddress } from '@/lib/erc3009';

// Types matching the API response
interface UploadResponse {
  jobId: string;
  status: 'queued';
  message: string;
}

interface JobStatus {
  id: string;
  status: 'QUEUED' | 'PARSING' | 'PENDING_APPROVAL' | 'PROCESSING' | 'completed' | 'partial' | 'failed';
  totalLines: number;
  parsedCount: number;
  invalidCount: number;
  chunks: number;
  createdAt: string;
  error?: string;
  parserSummary?: {
     valid: number;
     invalid: number;
     preview: any[];
  }
}

interface SignAuthorizationFn {
  (params: {
    tokenAddress: string;
    from: string;
    to: string;
    amount: string;
    chainId?: number;
  }): Promise<{ v: number; r: string; s: string; nonce: string; validAfter: number; validBefore: number }>;
}

interface AsyncBatchPaymentOptions {
  /** Connected wallet — required: every call is authenticated. */
  wallet?: string | null;
  /** Wallet chain id (used for signing + execution). */
  chainId?: number;
  /** Chain slug as the API expects it (ethereum, base, sepolia, ...). */
  chain?: string;
  /** Wallet signer for EIP-3009 authorizations (from useUnifiedWallet). */
  signAuthorization?: SignAuthorizationFn;
}

/**
 * File-upload batch flow: upload → parse (cron) → approve.
 *
 * Execution is non-custodial: the wallet signs one EIP-3009 authorization per
 * row (off-chain, no gas) and the relayer submits them. The API never fakes a
 * success — without signatures it returns the rows to sign instead.
 */
export function useAsyncBatchPayment(options: AsyncBatchPaymentOptions = {}) {
  const { wallet, chainId, chain, signAuthorization } = options;
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // 1. Upload File
  const uploadFile = useCallback(async (file: File) => {
    if (!wallet) {
      toast({ variant: "destructive", title: "Connect your wallet first", description: "Uploads are authenticated." });
      return;
    }
    setIsUploading(true);
    setJobId(null);
    setJobStatus(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/batch/upload', {
        method: 'POST',
        headers: { ...authHeaders(wallet) },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data: UploadResponse = await response.json();
      setJobId(data.jobId);
      toast({
        title: "File Uploaded",
        description: "Your file is being processed in the background.",
      });
      
      // Start polling immediately
      startPolling(data.jobId);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  }, [wallet, toast]);

  // 2. Poll Status
  const checkStatus = useCallback(async (id: string) => {
    if (!wallet) return;
    try {
      const response = await fetch(`/api/batch/status?id=${id}`, {
        headers: { ...authHeaders(wallet) },
      });
      if (response.ok) {
        const data: JobStatus = await response.json();
        setJobStatus(data);
        
        // Stop polling if terminal state or waiting for action
        if (data.status === 'PENDING_APPROVAL' || data.status === 'completed' || data.status === 'partial' || data.status === 'failed') {
            stopPolling();
             if (data.status === 'PENDING_APPROVAL') {
                toast({ title: "Analysis Complete", description: "Please review and approve execution." });
            }
        }
      }
    } catch (error) {
       console.error("Polling error", error);
    }
  }, [wallet, toast]);

  const startPolling = (id: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsPolling(true);
    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(() => checkStatus(id), 2000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
    }
    setIsPolling(false);
  };

  // 3. Approve Execution — sign one authorization per row, then submit.
  const executeBatch = useCallback(async () => {
    if (!jobId || !wallet) return;

    try {
      // Step 1: fetch the parsed rows that need signing.
      const prep = await fetch('/api/batch/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(wallet) },
        body: JSON.stringify({ jobId, chain, chainId }),
      });
      const prepData = await prep.json().catch(() => ({}));
      if (!prep.ok) throw new Error(prepData.error || "Failed to prepare execution");

      const rows: Array<{ index: number; recipient: string; amount: string }> = Array.isArray(prepData.items)
        ? prepData.items
        : [];
      const token = String(prepData.token ?? "USDC");
      const resolvedChainId = Number(prepData.chainId) || chainId;
      const tokenAddress = resolvedChainId ? getTokenAddress(resolvedChainId, token) : null;
      if (!signAuthorization || !tokenAddress) {
        throw new Error("Connect a wallet that can sign EIP-3009 authorizations (USDC batches).");
      }

      // Step 2: one off-chain signature per row (no gas moves here).
      const authorizations = [];
      for (const row of rows) {
        const auth = await signAuthorization({
          tokenAddress,
          from: wallet,
          to: row.recipient,
          amount: row.amount,
          chainId: resolvedChainId,
        });
        authorizations.push({
          index: row.index,
          validAfter: auth.validAfter,
          validBefore: auth.validBefore,
          nonce: auth.nonce,
          v: auth.v,
          r: auth.r,
          s: auth.s,
        });
      }

      // Step 3: the relayer submits them from the payer's own balance.
      const response = await fetch('/api/batch/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(wallet) },
        body: JSON.stringify({ jobId, chain, chainId, authorizations }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to execute");

      toast({
        title: "Execution complete",
        description: `${data.execution?.completed ?? 0} settled, ${data.execution?.failed ?? 0} failed`,
      });

      // Resume polling to pick up the terminal job status.
      startPolling(jobId);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Execution Error",
        description: error.message
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, wallet, chain, chainId, signAuthorization, toast]);

  return {
    uploadFile,
    executeBatch,
    jobId,
    jobStatus,
    isUploading,
    isPolling
  };
}
