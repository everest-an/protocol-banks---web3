// Multi-signature wallet service using Safe (Gnosis Safe) protocol
import { ethers } from "ethers"

// Dynamic import to avoid pulling pg into client bundles
async function getPrisma() {
  if (typeof window !== 'undefined') return null
  try {
    const mod = await import('@/lib/prisma')
    return mod.prisma
  } catch {
    return null
  }
}

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
  // Get all multisig wallets for a user
  async getWallets(ownerAddress: string): Promise<MultisigWallet[]> {
    const prisma = await getPrisma()
    if (!prisma) return []
    const wallets: any[] = await prisma.$queryRawUnsafe(
      `SELECT mw.*, json_agg(ms.*) as signers
       FROM multisig_wallets mw
       LEFT JOIN multisig_signers ms ON ms.multisig_id = mw.id
       WHERE mw.created_by = $1 AND mw.is_active = true
       GROUP BY mw.id
       ORDER BY mw.created_at DESC`,
      ownerAddress,
    )

    return wallets.map((w) => ({
      ...w,
      signers: w.signers?.[0] ? w.signers : [],
    }))
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

    const prisma = await getPrisma()
    if (!prisma) throw new Error("Database not available")

    // Create wallet record
    const walletRows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO multisig_wallets (name, wallet_address, chain_id, threshold, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      name,
      predictedAddress,
      chainId,
      threshold,
      createdBy,
    )

    const wallet = walletRows[0]
    if (!wallet) throw new Error("Failed to create multisig wallet")

    // Add signers
    for (const address of signers) {
      await prisma!.$executeRawUnsafe(
        `INSERT INTO multisig_signers (multisig_id, signer_address, added_by)
         VALUES ($1, $2, $3)`,
        wallet.id,
        address.toLowerCase(),
        createdBy,
      )
    }

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
    const prisma = await getPrisma()
    if (!prisma) throw new Error("Database not available")

    // Get current nonce
    const nonceRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT safe_nonce FROM multisig_transactions
       WHERE multisig_id = $1
       ORDER BY safe_nonce DESC
       LIMIT 1`,
      params.multisigId,
    )

    const nextNonce = (nonceRows[0]?.safe_nonce ?? -1) + 1

    const rows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO multisig_transactions (multisig_id, to_address, value, data, safe_nonce, status, created_by, description, token_symbol, amount_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      params.multisigId,
      params.toAddress,
      params.value,
      params.data || "0x",
      nextNonce,
      "pending",
      params.createdBy,
      params.description || null,
      params.tokenSymbol || null,
      params.amountUsd || null,
    )

    if (!rows[0]) throw new Error("Failed to create multisig transaction")
    return rows[0]
  }

  // Sign/confirm a transaction
  async confirmTransaction(params: {
    transactionId: string
    signerAddress: string
    signature: string
  }): Promise<MultisigConfirmation> {
    const prisma = await getPrisma()
    if (!prisma) throw new Error("Database not available")

    const rows: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO multisig_confirmations (transaction_id, signer_address, signature)
       VALUES ($1, $2, $3)
       RETURNING *`,
      params.transactionId,
      params.signerAddress.toLowerCase(),
      params.signature,
    )

    if (!rows[0]) throw new Error("Failed to confirm transaction")

    // Check if threshold reached
    await this.checkAndUpdateStatus(params.transactionId)

    return rows[0]
  }

  // Check if transaction has enough confirmations
  private async checkAndUpdateStatus(transactionId: string): Promise<void> {
    const prisma = await getPrisma()
    if (!prisma) return

    const txRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT mt.*, mw.threshold
       FROM multisig_transactions mt
       JOIN multisig_wallets mw ON mw.id = mt.multisig_id
       WHERE mt.id = $1`,
      transactionId,
    )

    if (!txRows[0]) return

    const countRows: { count: bigint }[] = await prisma!.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM multisig_confirmations WHERE transaction_id = $1`,
      transactionId,
    )

    const count = Number(countRows[0]?.count || 0)

    if (count >= txRows[0].threshold) {
      await prisma!.$executeRawUnsafe(
        `UPDATE multisig_transactions SET status = $1 WHERE id = $2`,
        "confirmed",
        transactionId,
      )
    }
  }

  // Get pending transactions for a wallet
  async getPendingTransactions(multisigId: string): Promise<MultisigTransaction[]> {
    const prisma = await getPrisma()
    if (!prisma) return []

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT mt.*, json_agg(mc.*) as confirmations
       FROM multisig_transactions mt
       LEFT JOIN multisig_confirmations mc ON mc.transaction_id = mt.id
       WHERE mt.multisig_id = $1 AND mt.status IN ('pending', 'confirmed')
       GROUP BY mt.id
       ORDER BY mt.safe_nonce ASC`,
      multisigId,
    )

    return rows.map((r) => ({
      ...r,
      confirmations: r.confirmations?.[0] ? r.confirmations : [],
    }))
  }

  // Execute a confirmed transaction
  async markExecuted(transactionId: string, txHash: string): Promise<void> {
    const prisma = await getPrisma()
    if (!prisma) throw new Error("Database not available")

    await prisma.$executeRawUnsafe(
      `UPDATE multisig_transactions SET status = $1, executed_at = $2, execution_tx_hash = $3 WHERE id = $4`,
      "executed",
      new Date().toISOString(),
      txHash,
      transactionId,
    )
  }
}

export const multisigService = new MultisigService()
