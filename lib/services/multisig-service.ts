/**
 * Multisig Service
 * Manages multisig wallet transactions and confirmations
 */

import { createClient } from '@/lib/supabase-client';
import { WebhookTriggerService } from './webhook-trigger-service';
import { ethers } from 'ethers';

// ============================================
// Types
// ============================================

export type MultisigTransactionStatus = 'pending' | 'confirmed' | 'executed' | 'failed' | 'cancelled';

export interface MultisigWallet {
  id: string;
  name: string;
  address: string;
  chain_id: number;
  threshold: number;
  signers: string[];
  owner_address: string;
  created_at: string;
  updated_at: string;
}

export interface MultisigTransaction {
  id: string;
  multisig_id: string;
  to_address: string;
  value: string;
  data: string;
  nonce: number;
  status: MultisigTransactionStatus;
  threshold: number;
  confirmations: MultisigConfirmation[];
  execution_tx_hash?: string;
  error_message?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MultisigConfirmation {
  id: string;
  transaction_id: string;
  signer_address: string;
  signature: string;
  confirmed_at: string;
}

export interface CreateTransactionInput {
  multisig_id: string;
  to_address: string;
  value: string;
  data?: string;
  created_by: string;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Verify a signature against a message and signer address
 */
export function verifySignature(
  message: string,
  signature: string,
  expectedSigner: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('[Multisig] Signature verification failed:', error);
    return false;
  }
}

/**
 * Create the message to be signed for a transaction
 */
export function createTransactionMessage(
  multisigAddress: string,
  to: string,
  value: string,
  data: string,
  nonce: number,
  chainId: number
): string {
  return ethers.solidityPackedKeccak256(
    ['address', 'address', 'uint256', 'bytes', 'uint256', 'uint256'],
    [multisigAddress, to, value, data || '0x', nonce, chainId]
  );
}

/**
 * Check if transaction has reached threshold
 */
export function hasReachedThreshold(
  confirmations: number,
  threshold: number
): boolean {
  return confirmations >= threshold;
}

// ============================================
// Multisig Service
// ============================================

export class MultisigService {
  private supabase;
  private webhookTrigger: WebhookTriggerService;

  constructor() {
    this.supabase = createClient();
    this.webhookTrigger = new WebhookTriggerService();
  }

  /**
   * Get a multisig wallet by ID
   */
  async getWallet(id: string, ownerAddress: string): Promise<MultisigWallet | null> {
    const { data, error } = await this.supabase
      .from('multisig_wallets')
      .select('*')
      .eq('id', id)
      .eq('owner_address', ownerAddress.toLowerCase())
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get multisig wallet: ${error.message}`);
    }

    return data as MultisigWallet;
  }

  /**
   * Create a new transaction proposal
   */
  async createTransaction(input: CreateTransactionInput): Promise<MultisigTransaction> {
    // Get multisig wallet
    const { data: wallet, error: walletError } = await this.supabase
      .from('multisig_wallets')
      .select('*')
      .eq('id', input.multisig_id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Multisig wallet not found');
    }

    // Get next nonce
    const { data: lastTx } = await this.supabase
      .from('multisig_transactions')
      .select('nonce')
      .eq('multisig_id', input.multisig_id)
      .order('nonce', { ascending: false })
      .limit(1)
      .single();

    const nonce = lastTx ? lastTx.nonce + 1 : 0;

    // Create transaction
    const transactionData = {
      multisig_id: input.multisig_id,
      to_address: input.to_address.toLowerCase(),
      value: input.value,
      data: input.data || '0x',
      nonce,
      status: 'pending' as MultisigTransactionStatus,
      threshold: wallet.threshold,
      created_by: input.created_by.toLowerCase(),
    };

    const { data, error } = await this.supabase
      .from('multisig_transactions')
      .insert([transactionData])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    // Trigger webhook
    await this.webhookTrigger.triggerMultisigProposalCreated(wallet.owner_address, {
      transaction_id: data.id,
      multisig_id: input.multisig_id,
      wallet_address: wallet.address,
      to_address: input.to_address,
      value: input.value,
      status: 'pending',
      threshold: wallet.threshold,
      confirmations: 0,
      created_at: data.created_at,
    });

    return { ...data, confirmations: [] } as MultisigTransaction;
  }

  /**
   * Add a confirmation to a transaction
   */
  async confirmTransaction(
    transactionId: string,
    signerAddress: string,
    signature: string
  ): Promise<MultisigTransaction> {
    // Get transaction with wallet info
    const { data: transaction, error: txError } = await this.supabase
      .from('multisig_transactions')
      .select(`
        *,
        multisig_wallets!inner(*)
      `)
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      throw new Error('Transaction not found');
    }

    const wallet = transaction.multisig_wallets as MultisigWallet;

    // Verify signer is authorized
    const normalizedSigner = signerAddress.toLowerCase();
    const isAuthorizedSigner = wallet.signers.some(
      (s: string) => s.toLowerCase() === normalizedSigner
    );

    if (!isAuthorizedSigner) {
      throw new Error('Signer is not authorized for this multisig');
    }

    // Verify signature
    const message = createTransactionMessage(
      wallet.address,
      transaction.to_address,
      transaction.value,
      transaction.data,
      transaction.nonce,
      wallet.chain_id
    );

    if (!verifySignature(message, signature, signerAddress)) {
      throw new Error('Invalid signature');
    }

    // Check if already confirmed by this signer
    const { data: existingConfirmation } = await this.supabase
      .from('multisig_confirmations')
      .select('id')
      .eq('transaction_id', transactionId)
      .eq('signer_address', normalizedSigner)
      .single();

    if (existingConfirmation) {
      throw new Error('Transaction already confirmed by this signer');
    }

    // Add confirmation
    const { error: confirmError } = await this.supabase
      .from('multisig_confirmations')
      .insert([{
        transaction_id: transactionId,
        signer_address: normalizedSigner,
        signature,
      }]);

    if (confirmError) {
      throw new Error(`Failed to add confirmation: ${confirmError.message}`);
    }

    // Get updated confirmation count
    const { count } = await this.supabase
      .from('multisig_confirmations')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_id', transactionId);

    const confirmationCount = count || 0;

    // Check if threshold reached
    if (hasReachedThreshold(confirmationCount, transaction.threshold)) {
      await this.supabase
        .from('multisig_transactions')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);
    }

    // Return updated transaction
    return this.getTransaction(transactionId);
  }

  /**
   * Get a transaction by ID
   */
  async getTransaction(id: string): Promise<MultisigTransaction> {
    const { data: transaction, error } = await this.supabase
      .from('multisig_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !transaction) {
      throw new Error('Transaction not found');
    }

    // Get confirmations
    const { data: confirmations } = await this.supabase
      .from('multisig_confirmations')
      .select('*')
      .eq('transaction_id', id);

    return {
      ...transaction,
      confirmations: confirmations || [],
    } as MultisigTransaction;
  }

  /**
   * Execute a confirmed transaction
   */
  async executeTransaction(
    transactionId: string,
    executorAddress: string
  ): Promise<{ txHash: string }> {
    // Get transaction
    const transaction = await this.getTransaction(transactionId);

    if (transaction.status !== 'confirmed') {
      throw new Error('Transaction is not confirmed');
    }

    // Get wallet
    const { data: wallet, error: walletError } = await this.supabase
      .from('multisig_wallets')
      .select('*')
      .eq('id', transaction.multisig_id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Multisig wallet not found');
    }

    // Verify all signatures
    const message = createTransactionMessage(
      wallet.address,
      transaction.to_address,
      transaction.value,
      transaction.data,
      transaction.nonce,
      wallet.chain_id
    );

    for (const confirmation of transaction.confirmations) {
      if (!verifySignature(message, confirmation.signature, confirmation.signer_address)) {
        throw new Error(`Invalid signature from ${confirmation.signer_address}`);
      }
    }

    try {
      // In production, this would submit to the blockchain
      // For now, we simulate execution
      const txHash = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;

      // Update transaction status
      await this.supabase
        .from('multisig_transactions')
        .update({
          status: 'executed',
          execution_tx_hash: txHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      // Trigger webhook
      await this.webhookTrigger.triggerMultisigExecuted(wallet.owner_address, {
        transaction_id: transactionId,
        multisig_id: transaction.multisig_id,
        wallet_address: wallet.address,
        to_address: transaction.to_address,
        value: transaction.value,
        status: 'executed',
        threshold: transaction.threshold,
        confirmations: transaction.confirmations.length,
        execution_tx_hash: txHash,
        created_at: transaction.created_at,
      });

      return { txHash };
    } catch (error: any) {
      // Update transaction with error
      await this.supabase
        .from('multisig_transactions')
        .update({
          status: 'failed',
          error_message: error.message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      throw error;
    }
  }

  /**
   * Get pending transactions for a multisig
   */
  async getPendingTransactions(multisigId: string): Promise<MultisigTransaction[]> {
    const { data, error } = await this.supabase
      .from('multisig_transactions')
      .select('*')
      .eq('multisig_id', multisigId)
      .in('status', ['pending', 'confirmed'])
      .order('nonce', { ascending: true });

    if (error) {
      throw new Error(`Failed to get pending transactions: ${error.message}`);
    }

    // Get confirmations for each transaction
    const transactions = await Promise.all(
      (data || []).map(async (tx) => {
        const { data: confirmations } = await this.supabase
          .from('multisig_confirmations')
          .select('*')
          .eq('transaction_id', tx.id);

        return {
          ...tx,
          confirmations: confirmations || [],
        } as MultisigTransaction;
      })
    );

    return transactions;
  }

  /**
   * Get confirmed transactions ready for execution
   */
  async getConfirmedTransactions(limit: number = 50): Promise<MultisigTransaction[]> {
    const { data, error } = await this.supabase
      .from('multisig_transactions')
      .select('*')
      .eq('status', 'confirmed')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get confirmed transactions: ${error.message}`);
    }

    return (data || []).map(tx => ({ ...tx, confirmations: [] })) as MultisigTransaction[];
  }
}

// Export singleton instance
export const multisigService = new MultisigService();
