/**
 * MCP Token & Network Tools
 *
 * Read-only tools for querying supported tokens, networks,
 * and payment quotes. No authentication required.
 *
 * @module lib/mcp/tools/token-tools
 */

import { z } from 'zod'
import {
  ALL_NETWORKS,
  NETWORK_TOKENS,
  getMainnetNetworks,
} from '@/lib/networks'

// ─── Tool Definitions ───────────────────────────────────────────────

export const listSupportedTokensTool = {
  name: 'list_supported_tokens',
  description:
    'List all supported tokens and networks for payments. Returns token symbols, contract addresses, decimals, and which networks they are available on. No authentication required.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      network: {
        type: 'string',
        description:
          'Optional network filter (e.g. "ethereum", "base", "tron"). If omitted, returns tokens for all mainnet networks.',
      },
      include_testnets: {
        type: 'boolean',
        description: 'Whether to include testnet networks (default: false).',
      },
    },
  },
}

export const getPaymentQuoteTool = {
  name: 'get_payment_quote',
  description:
    'Get a fee estimate for a payment on a specific network. Returns the protocol fee percentage and estimated total. No authentication required.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      network: {
        type: 'string',
        description: 'Network to estimate fees for (e.g. "ethereum", "base", "tron").',
      },
      token: {
        type: 'string',
        description: 'Token symbol (e.g. "USDT", "USDC", "DAI").',
      },
      amount: {
        type: 'string',
        description: 'Payment amount as a decimal string (e.g. "100.00").',
      },
    },
    required: ['network', 'token', 'amount'],
  },
}

// ─── Handlers ───────────────────────────────────────────────────────

export async function handleListSupportedTokens(args: {
  network?: string
  include_testnets?: boolean
}): Promise<unknown> {
  const includeTestnets = args.include_testnets ?? false

  // Filter networks
  const networks = Object.entries(ALL_NETWORKS)
    .filter(([, config]) => includeTestnets || !config.isTestnet)
    .filter(([id]) => !args.network || id === args.network)

  const result = networks.map(([id, config]) => {
    const tokens = NETWORK_TOKENS[id] || []
    return {
      network: id,
      name: config.name,
      type: config.type,
      chain_id: config.chainId,
      is_testnet: config.isTestnet,
      native_currency: config.nativeCurrency,
      tokens: tokens.map((t) => ({
        symbol: t.symbol,
        address: t.address,
        decimals: t.decimals,
      })),
    }
  })

  return {
    networks: result,
    total_networks: result.length,
    total_tokens: result.reduce((sum, n) => sum + n.tokens.length, 0),
  }
}

export async function handleGetPaymentQuote(args: {
  network: string
  token: string
  amount: string
}): Promise<unknown> {
  const { network, token, amount } = args

  // Validate network
  const networkConfig = ALL_NETWORKS[network]
  if (!networkConfig) {
    throw new Error(
      `Unsupported network "${network}". Use list_supported_tokens to see available networks.`
    )
  }

  // Validate token
  const tokens = NETWORK_TOKENS[network] || []
  const tokenConfig = tokens.find(
    (t) => t.symbol.toUpperCase() === token.toUpperCase()
  )
  if (!tokenConfig) {
    throw new Error(
      `Token "${token}" is not supported on ${network}. Available: ${tokens.map((t) => t.symbol).join(', ')}`
    )
  }

  // Parse amount
  const amountNum = parseFloat(amount)
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  // Calculate fees (0.5% protocol fee, capped at $50)
  const feePercent = 0.5
  const rawFee = amountNum * (feePercent / 100)
  const fee = Math.min(rawFee, 50)
  const total = amountNum + fee

  return {
    network,
    network_name: networkConfig.name,
    token: tokenConfig.symbol,
    token_address: tokenConfig.address,
    amount,
    fee: fee.toFixed(tokenConfig.decimals > 6 ? 6 : 2),
    fee_percent: `${feePercent}%`,
    total: total.toFixed(tokenConfig.decimals > 6 ? 6 : 2),
    currency: tokenConfig.symbol,
    estimated_confirmation:
      networkConfig.type === 'TRON' ? '~3 seconds' : '~12 seconds',
  }
}
