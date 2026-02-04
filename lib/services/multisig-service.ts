/**
 * Multisig Service
 * Manages multisig wallet transactions and confirmations
 */

import { prisma } from '@/lib/prisma';
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
  private webhookTrigger: WebhookTriggerService;

  constructor() {
    this.webhookTrigger = new WebhookTriggerService();
  }

  /**
   * Get a multisig wallet by ID
   */
  async getWallet(id: string, ownerAddress: string): Promise<MultisigWallet | null> {
    const data = await prisma.multisigWallet.findFirst({
        where: {
            id,
            owner_address: ownerAddress.toLowerCase()
        }
    });

    if (!data) return null;

    return {
        ...data,
        created_at: data.created_at.toISOString(),
        updated_at: data.updated_at.toISOString()
    } as MultisigWallet;
  }

  /**
   * Create a new transaction proposal
   */
  async createTransaction(input: CreateTransactionInput): Promise<MultisigTransaction> {
    // Get multisig wallet
    const wallet = await prisma.multisigWallet.findUnique({
      where: { id: input.multisig_id }
    });

    if (!wallet) {
      throw new Error('Multisig wallet not found');
    }

    // Get next nonce
    const lastTx = await prisma.multisigTransaction.findFirst({
      where: { multisig_id: input.multisig_id },
      orderBy: { nonce: 'desc' },
      select: { nonce: true }
    });

    const nonce = lastTx ? lastTx.nonce + 1 : 0;

    // Create transaction
    const data = await prisma.multisigTransaction.create({
      data: {
        multisig_id: input.multisig_id,
        to_address: input.to_address.toLowerCase(),
        value: input.value,
        data: input.data || '0x',
        nonce,
        status: 'pending',
        threshold: wallet.threshold,
        created_by: input.created_by.toLowerCase(),
      }
    });

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
      created_at: data.created_at.toISOString(),
    });

    return {
      ...data,
      confirmations: [],
      execution_tx_hash: data.execution_tx_hash || undefined,
      error_message: data.error_message || undefined,
      created_at: data.created_at.toISOString(),
      updated_at: data.updated_at.toISOString()
    } as MultisigTransaction;
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
    const transaction = await prisma.multisigTransaction.findUnique({
      where: { id: transactionId },
      include: { multisig_wallet: true }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const wallet = transaction.multisig_wallet;

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
      transaction.data || '0x',
      transaction.nonce,
      wallet.chain_id
    );

    if (!verifySignature(message, signature, signerAddress)) {
      throw new Error('Invalid signature');
    }

    // Check if already confirmed by this signer
    const existingConfirmation = await prisma.multisigConfirmation.findUnique({
      where: {
        transaction_id_signer_address: {
          transaction_id: transactionId,
          signer_address: normalizedSigner
        }
      }
    });

    if (existingConfirmation) {
      throw new Error('Transaction already confirmed by this signer');
    }

    // Add confirmation
    await prisma.multisigConfirmation.create({
      data: {
        transaction_id: transactionId,
        signer_address: normalizedSigner,
        signature,
        confirmed_at: new Date()
      }
    });

    // Get updated confirmation count
    const confirmationCount = await prisma.multisigConfirmation.count({
      where: { transaction_id: transactionId }
    });

    // Check if threshold reached
    if (hasReachedThreshold(confirmationCount, transaction.threshold)) {
      await prisma.multisigTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'confirmed',
          updated_at: new Date()
        }
      });
    }

    // Return updated transaction
    return this.getTransaction(transactionId);
  }

  /**
   * Get a transaction by ID
   */
  async getTransaction(id: string): Promise<MultisigTransaction> {
    const transaction = await prisma.multisigTransaction.findUnique({
      where: { id },
      include: { confirmations: true }
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return {
      ...transaction,
      execution_tx_hash: transaction.execution_tx_hash || undefined,
      error_message: transaction.error_message || undefined,
      created_at: transaction.created_at.toISOString(),
      updated_at: transaction.updated_at.toISOString(),
      confirmations: transaction.confirmations.map(c => ({
        ...c,
        confirmed_at: c.confirmed_at.toISOString()
      })),
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
    const wallet = await prisma.multisigWallet.findUnique({
      where: { id: transaction.multisig_id }
    });

    if (!wallet) {
      throw new Error('Multisig wallet not found');
    }

    // Verify all signatures
    const message = createTransactionMessage(
      wallet.address,
      transaction.to_address,
      transaction.value,
      transaction.data || '0x',
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
      await prisma.multisigTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'executed',
          execution_tx_hash: txHash,
          updated_at: new Date()
        }
      });

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
      await prisma.multisigTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'failed',
          error_message: error.message,
          updated_at: new Date()
        }
      });

      throw error;
    }
  }

  /**
   * Get pending transactions for a multisig
   */
  async getPendingTransactions(multisigId: string): Promise<MultisigTransaction[]> {
    const transactions = await prisma.multisigTransaction.findMany({
      where: {
        multisig_id: multisigId,
        status: { in: ['pending', 'confirmed'] }
      },
      orderBy: { nonce: 'asc' },
      include: { confirmations: true }
    });

    return transactions.map(tx => ({
        ...tx,
        execution_tx_hash: tx.execution_tx_hash || undefined,
        error_message: tx.error_message || undefined,
        created_at: tx.created_at.toISOString(),
        updated_at: tx.updated_at.toISOString(),
        confirmations: tx.confirmations.map(c => ({
            ...c,
            confirmed_at: c.confirmed_at.toISOString()
        }))
    })) as MultisigTransaction[];
  }

  /**
   * Get confirmed transactions ready for execution
   */
  async getConfirmedTransactions(limit: number = 50): Promise<MultisigTransaction[]> {
    const transactions = await prisma.multisigTransaction.findMany({
      where: { status: 'confirmed' },
      orderBy: { created_at: 'asc' },
      take: limit,
    });

    return transactions.map(tx => ({
      ...tx,
      confirmations: [],
      execution_tx_hash: tx.execution_tx_hash || undefined,
      error_message: tx.error_message || undefined,
      created_at: tx.created_at.toISOString(),
      updated_at: tx.updated_at.toISOString()
    })) as MultisigTransaction[];
  }
}

// Export singleton instance
export const multisigService = new MultisigService();
