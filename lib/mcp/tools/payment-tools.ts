/**
 * MCP Payment Tools
 *
 * Authenticated tools for creating, querying, and managing payments.
 * All tools require a valid JWT Bearer token.
 *
 * @module lib/mcp/tools/payment-tools
 */

import { prisma } from '@/lib/prisma'
import type { McpAuthContext } from '../auth'
import { requireAuth } from '../auth'
import { gasManagerService } from '@/lib/services/gas-manager-service'
import { txExecutorService } from '@/lib/services/tx-executor-service'
import { budgetGuardService } from '@/lib/services/budget-guard-service'
import type { Address, Hex } from 'viem'

// ─── Tool Definitions ───────────────────────────────────────────────

export const createPaymentTool = {
  name: 'create_payment',
  description:
    'Create a new payment. Requires authentication. Creates a payment record in pending status. The actual on-chain transaction must be submitted separately.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      to_address: {
        type: 'string',
        description: 'Recipient wallet address (EVM 0x... or TRON T...).',
      },
      amount: {
        type: 'string',
        description: 'Payment amount as a decimal string (e.g. "100.00").',
      },
      token: {
        type: 'string',
        description: 'Token symbol (e.g. "USDT", "USDC", "DAI").',
      },
      network: {
        type: 'string',
        description: 'Network to send on (e.g. "ethereum", "base", "tron").',
      },
      memo: {
        type: 'string',
        description: 'Optional payment memo or reference.',
      },
    },
    required: ['to_address', 'amount', 'token', 'network'],
  },
}

export const checkPaymentStatusTool = {
  name: 'check_payment_status',
  description:
    'Check the status of a payment by ID. Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      payment_id: {
        type: 'string',
        description: 'The payment ID to check.',
      },
    },
    required: ['payment_id'],
  },
}

export const listPaymentsTool = {
  name: 'list_payments',
  description:
    'List recent payments for the authenticated wallet. Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status: pending, completed, failed.',
      },
      network: {
        type: 'string',
        description: 'Filter by network (e.g. "ethereum", "base").',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20, max: 100).',
      },
    },
  },
}

// ─── Handlers ───────────────────────────────────────────────────────

export async function handleCreatePayment(
  args: {
    to_address: string
    amount: string
    token: string
    network: string
    memo?: string
  },
  authCtx: McpAuthContext
): Promise<unknown> {
  const address = requireAuth(authCtx)

  const amountNum = parseFloat(args.amount)
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  // Resolve chain ID from network name
  const { ALL_NETWORKS } = await import('@/lib/networks')
  const networkConfig = ALL_NETWORKS[args.network]
  const chainId = networkConfig?.chainId ?? 1

  // Create a payment proposal (pending state)
  const payment = await prisma.paymentProposal.create({
    data: {
      agent_id: 'mcp',
      owner_address: address,
      recipient_address: args.to_address.toLowerCase(),
      token: args.token.toUpperCase(),
      amount: args.amount,
      chain_id: chainId,
      reason: args.memo ?? `MCP payment: ${args.amount} ${args.token} on ${args.network}`,
      status: 'pending',
    },
  })

  return {
    payment_id: payment.id,
    status: 'pending',
    from: address,
    to: args.to_address,
    amount: args.amount,
    token: args.token,
    network: args.network,
    memo: args.memo,
    created_at: payment.created_at.toISOString(),
    message: 'Payment proposal created. Submit the on-chain transaction to complete.',
  }
}

export async function handleCheckPaymentStatus(
  args: { payment_id: string },
  authCtx: McpAuthContext
): Promise<unknown> {
  const address = requireAuth(authCtx)

  // Check proposals first
  const proposal = await prisma.paymentProposal.findFirst({
    where: {
      id: args.payment_id,
      owner_address: address,
    },
  })

  if (proposal) {
    return {
      payment_id: proposal.id,
      type: 'proposal',
      status: proposal.status,
      to: proposal.recipient_address,
      amount: proposal.amount,
      token: proposal.token,
      chain_id: proposal.chain_id,
      tx_hash: proposal.tx_hash,
      created_at: proposal.created_at.toISOString(),
    }
  }

  // Check payment records
  const payment = await prisma.payment.findFirst({
    where: {
      id: args.payment_id,
      from_address: address,
    },
  })

  if (payment) {
    return {
      payment_id: payment.id,
      type: 'payment',
      status: payment.status,
      to: payment.to_address,
      amount: payment.amount,
      token: payment.token_symbol ?? payment.token,
      network: payment.chain,
      tx_hash: payment.tx_hash,
      created_at: payment.created_at.toISOString(),
    }
  }

  throw new Error(`Payment "${args.payment_id}" not found.`)
}

export async function handleListPayments(
  args: { status?: string; network?: string; limit?: number },
  authCtx: McpAuthContext
): Promise<unknown> {
  const address = requireAuth(authCtx)
  const limit = Math.min(args.limit ?? 20, 100)

  const where: Record<string, unknown> = { from_address: address }
  if (args.status) where.status = args.status
  if (args.network) where.chain = args.network

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      status: true,
      from_address: true,
      to_address: true,
      amount: true,
      token: true,
      token_symbol: true,
      chain: true,
      tx_hash: true,
      created_at: true,
    },
  })

  return {
    payments: payments.map((p) => ({
      payment_id: p.id,
      status: p.status,
      to: p.to_address,
      amount: p.amount,
      token: p.token_symbol ?? p.token,
      network: p.chain,
      tx_hash: p.tx_hash,
      created_at: p.created_at.toISOString(),
    })),
    total: payments.length,
  }
}

// ─── Gas Estimation Tool ──────────────────────────────────────────

export const estimateGasTool = {
  name: 'estimate_gas',
  description:
    'Estimate gas cost for an ERC-20 stablecoin transfer. No authentication required.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      network: {
        type: 'string',
        description: 'Network name (e.g. "base", "ethereum", "arbitrum").',
      },
      token: {
        type: 'string',
        description: 'Token symbol (e.g. "USDC", "USDT").',
      },
      amount: {
        type: 'string',
        description: 'Transfer amount (e.g. "100").',
      },
      to_address: {
        type: 'string',
        description: 'Recipient address (0x...).',
      },
    },
    required: ['network', 'token', 'amount', 'to_address'],
  },
}

export async function handleEstimateGas(
  args: { network: string; token: string; amount: string; to_address: string },
): Promise<unknown> {
  const { ALL_NETWORKS } = await import('@/lib/networks')
  const networkConfig = ALL_NETWORKS[args.network]
  const chainId = networkConfig?.chainId ?? 1

  const estimate = await gasManagerService.estimateTransferGas({
    chainId,
    token: args.token.toUpperCase(),
    to: args.to_address as Address,
    amount: args.amount,
    strategy: 'standard',
  })

  const gasPrice = await gasManagerService.getGasPrice(chainId)

  return {
    network: args.network,
    chainId,
    token: args.token.toUpperCase(),
    amount: args.amount,
    gasLimit: estimate.gasLimit.toString(),
    gasCostUsd: estimate.gasCostUsd,
    strategies: gasManagerService.formatGasPriceForDisplay(gasPrice).strategies,
  }
}

// ─── Cross-Chain Fee Comparison Tool ─────────────────────────────

export const compareChainFeesTool = {
  name: 'compare_chain_fees',
  description:
    'Compare transfer fees across all supported chains for a token. Identifies the cheapest chain. No authentication required.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      token: {
        type: 'string',
        description: 'Token symbol (e.g. "USDC").',
      },
      amount: {
        type: 'string',
        description: 'Transfer amount (e.g. "100").',
      },
      to_address: {
        type: 'string',
        description: 'Recipient address (0x...).',
      },
    },
    required: ['token', 'amount', 'to_address'],
  },
}

export async function handleCompareChainFees(
  args: { token: string; amount: string; to_address: string },
): Promise<unknown> {
  const comparisons = await gasManagerService.compareCrossChainFees({
    token: args.token.toUpperCase(),
    amount: args.amount,
    to: args.to_address as Address,
  })

  return {
    token: args.token.toUpperCase(),
    amount: args.amount,
    chains: comparisons.map(c => ({
      chain: c.chainName,
      chainId: c.chainId,
      gasCostUsd: c.gasCostUsd,
      estimatedSeconds: c.estimatedSeconds,
      gasless: c.gasless,
      recommended: c.recommended,
    })),
    recommendation: comparisons.find(c => c.recommended)?.chainName || 'Base',
  }
}

// ─── Execute Payment Tool (one-step on-chain) ───────────────────

export const executePaymentTool = {
  name: 'execute_payment',
  description:
    'Create AND execute a stablecoin payment on-chain in one step. Requires authentication. Uses server-side executor key to sign and broadcast the transaction.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      to_address: {
        type: 'string',
        description: 'Recipient wallet address (0x...).',
      },
      amount: {
        type: 'string',
        description: 'Payment amount as a decimal string (e.g. "100.00").',
      },
      token: {
        type: 'string',
        description: 'Token symbol (e.g. "USDC", "USDT", "DAI").',
      },
      network: {
        type: 'string',
        description: 'Network name (e.g. "base", "ethereum").',
      },
      memo: {
        type: 'string',
        description: 'Optional payment memo.',
      },
    },
    required: ['to_address', 'amount', 'token', 'network'],
  },
}

export async function handleExecutePayment(
  args: {
    to_address: string
    amount: string
    token: string
    network: string
    memo?: string
  },
  authCtx: McpAuthContext,
): Promise<unknown> {
  const address = requireAuth(authCtx)

  const executorKey = process.env.AGENT_EXECUTOR_PRIVATE_KEY
  if (!executorKey) {
    throw new Error('Server executor key not configured. Use create_payment for proposal-based flow.')
  }

  const { ALL_NETWORKS } = await import('@/lib/networks')
  const networkConfig = ALL_NETWORKS[args.network]
  const chainId = networkConfig?.chainId ?? 1
  const token = args.token.toUpperCase()

  // Budget guard check
  const guardResult = await budgetGuardService.check({
    agentId: 'mcp',
    ownerAddress: address,
    amount: args.amount,
    token,
    chainId,
  })

  if (!guardResult.allowed) {
    throw new Error(`Payment blocked: [${guardResult.layer}] ${guardResult.reason}`)
  }

  // Execute on-chain
  const result = await txExecutorService.smartExecute({
    privateKey: executorKey as Hex,
    to: args.to_address as Address,
    amount: args.amount,
    token,
    chainId,
  })

  if (!result.success) {
    budgetGuardService.recordFailure('mcp')
    throw new Error(`Transaction failed: ${result.error}`)
  }

  budgetGuardService.recordSuccess('mcp', parseFloat(args.amount))

  // Create payment record
  try {
    await prisma.paymentProposal.create({
      data: {
        agent_id: 'mcp',
        owner_address: address,
        recipient_address: args.to_address.toLowerCase(),
        token,
        amount: args.amount,
        chain_id: chainId,
        reason: args.memo ?? `MCP executed: ${args.amount} ${token} on ${args.network}`,
        status: 'executed',
        tx_hash: result.txHash,
      },
    })
  } catch {
    // Non-critical: payment already executed on-chain
  }

  return {
    status: 'executed',
    tx_hash: result.txHash,
    from: address,
    to: args.to_address,
    amount: args.amount,
    token,
    network: args.network,
    chain_id: chainId,
    block_number: result.blockNumber?.toString(),
    gas_used: result.gasUsed?.toString(),
    message: 'Payment executed on-chain successfully.',
  }
}
