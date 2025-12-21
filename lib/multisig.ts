// Multi-signature wallet service using Safe (Gnosis Safe) protocol
import { createClient } from "@/lib/supabase/client"
import { ethers } from "ethers"

// Safe contract addresses (mainnet)
const SAFE_ADDRESSES = {
  1: {
    // Ethereum
    proxyFactory: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    safeSingleton: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552",
    fallbackHandler: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
  },
  137: {
    // Polygon
    proxyFactory: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    safeSingleton: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552",
    fallbackHandler: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
  },
  8453: {
    // Base
    proxyFactory: "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2",
    safeSingleton: "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552",
    fallbackHandler: "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4",
  },
}

export interface MultisigWallet {
  id: string
  name: string
  wallet_address: string
  chain_id: number
  threshold: number
  created_by: string
  created_at: string
  is_active: boolean
  signers?: MultisigSigner[]
}

export interface MultisigSigner {
  id: string
  multisig_id: string
  signer_address: string
  signer_name?: string
  signer_email?: string
  is_active: boolean
}

export interface MultisigTransaction {
  id: string
  multisig_id: string
  safe_tx_hash?: string
  to_address: string
  value: string
  data?: string
  safe_nonce: number
  status: "pending" | "confirmed" | "executed" | "rejected"
  created_by: string
  created_at: string
  executed_at?: string
  execution_tx_hash?: string
  description?: string
  token_symbol?: string
  amount_usd?: number
  confirmations?: MultisigConfirmation[]
}

export interface MultisigConfirmation {
  id: string
  transaction_id: string
  signer_address: string
  signature: string
  confirmed_at: string
}

export class MultisigService {
  private supabase = createClient()

  // Get all multisig wallets for a user
  async getWallets(ownerAddress: string): Promise<MultisigWallet[]> {
    const { data, error } = await this.supabase
      .from("multisig_wallets")
      .select(`
        *,
        multisig_signers (*)
      `)
      .or(`created_by.eq.${ownerAddress}`)
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error) throw error
    return data || []
  }

  // Create a new multisig wallet
  async createWallet(params: {
    name: string
    signers: string[]
    threshold: number
    chainId: number
    createdBy: string
  }): Promise<MultisigWallet> {
    const { name, signers, threshold, chainId, createdBy } = params

    if (signers.length < threshold) {
      throw new Error("Threshold cannot be greater than number of signers")
    }

    // Calculate predicted Safe address
    const saltNonce = Date.now()
    const predictedAddress = await this.predictSafeAddress(signers, threshold, chainId, saltNonce)

    // Create wallet record
    const { data: wallet, error: walletError } = await this.supabase
      .from("multisig_wallets")
      .insert({
        name,
        wallet_address: predictedAddress,
        chain_id: chainId,
        threshold,
        created_by: createdBy,
      })
      .select()
      .single()

    if (walletError) throw walletError

    // Add signers
    const signerRecords = signers.map((address) => ({
      multisig_id: wallet.id,
      signer_address: address.toLowerCase(),
      added_by: createdBy,
    }))

    const { error: signersError } = await this.supabase.from("multisig_signers").insert(signerRecords)

    if (signersError) throw signersError

    return wallet
  }

  // Predict Safe address before deployment
  async predictSafeAddress(owners: string[], threshold: number, chainId: number, saltNonce: number): Promise<string> {
    const addresses = SAFE_ADDRESSES[chainId as keyof typeof SAFE_ADDRESSES]
    if (!addresses) throw new Error(`Chain ${chainId} not supported for Safe`)

    // Simplified prediction - in production, use Safe SDK
    const initializerData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address[]", "uint256", "address", "bytes", "address", "address", "uint256", "address"],
      [
        owners,
        threshold,
        ethers.ZeroAddress,
        "0x",
        addresses.fallbackHandler,
        ethers.ZeroAddress,
        0,
        ethers.ZeroAddress,
      ],
    )

    const salt = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["bytes32", "uint256"], [ethers.keccak256(initializerData), saltNonce]),
    )

    // This is simplified - actual prediction requires bytecode
    return ethers.getCreate2Address(
      addresses.proxyFactory,
      salt,
      ethers.keccak256("0x"), // Proxy bytecode hash
    )
  }

  // Create a transaction proposal
  async createTransaction(params: {
    multisigId: string
    toAddress: string
    value: string
    data?: string
    description?: string
    tokenSymbol?: string
    amountUsd?: number
    createdBy: string
  }): Promise<MultisigTransaction> {
    // Get current nonce
    const { data: lastTx } = await this.supabase
      .from("multisig_transactions")
      .select("safe_nonce")
      .eq("multisig_id", params.multisigId)
      .order("safe_nonce", { ascending: false })
      .limit(1)
      .single()

    const nextNonce = (lastTx?.safe_nonce || -1) + 1

    const { data, error } = await this.supabase
      .from("multisig_transactions")
      .insert({
        multisig_id: params.multisigId,
        to_address: params.toAddress,
        value: params.value,
        data: params.data || "0x",
        safe_nonce: nextNonce,
        status: "pending",
        created_by: params.createdBy,
        description: params.description,
        token_symbol: params.tokenSymbol,
        amount_usd: params.amountUsd,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  // Sign/confirm a transaction
  async confirmTransaction(params: {
    transactionId: string
    signerAddress: string
    signature: string
  }): Promise<MultisigConfirmation> {
    const { data, error } = await this.supabase
      .from("multisig_confirmations")
      .insert({
        transaction_id: params.transactionId,
        signer_address: params.signerAddress.toLowerCase(),
        signature: params.signature,
      })
      .select()
      .single()

    if (error) throw error

    // Check if threshold reached
    await this.checkAndUpdateStatus(params.transactionId)

    return data
  }

  // Check if transaction has enough confirmations
  private async checkAndUpdateStatus(transactionId: string): Promise<void> {
    const { data: tx } = await this.supabase
      .from("multisig_transactions")
      .select(`
        *,
        multisig_wallets!inner (threshold)
      `)
      .eq("id", transactionId)
      .single()

    if (!tx) return

    const { count } = await this.supabase
      .from("multisig_confirmations")
      .select("*", { count: "exact", head: true })
      .eq("transaction_id", transactionId)

    if (count && count >= tx.multisig_wallets.threshold) {
      await this.supabase.from("multisig_transactions").update({ status: "confirmed" }).eq("id", transactionId)
    }
  }

  // Get pending transactions for a wallet
  async getPendingTransactions(multisigId: string): Promise<MultisigTransaction[]> {
    const { data, error } = await this.supabase
      .from("multisig_transactions")
      .select(`
        *,
        multisig_confirmations (*)
      `)
      .eq("multisig_id", multisigId)
      .in("status", ["pending", "confirmed"])
      .order("safe_nonce", { ascending: true })

    if (error) throw error
    return data || []
  }

  // Execute a confirmed transaction
  async markExecuted(transactionId: string, txHash: string): Promise<void> {
    await this.supabase
      .from("multisig_transactions")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
        execution_tx_hash: txHash,
      })
      .eq("id", transactionId)
  }
}

export const multisigService = new MultisigService()
