/**
 * MCP Balance Tools
 *
 * Authenticated tool for querying wallet balances
 * across supported networks.
 *
 * @module lib/mcp/tools/balance-tools
 */

import type { McpAuthContext } from '../auth'
import { requireAuth } from '../auth'
import { ALL_NETWORKS, NETWORK_TOKENS } from '@/lib/networks'

// ─── Tool Definitions ───────────────────────────────────────────────

export const getBalanceTool = {
  name: 'get_balance',
  description:
    'Get token balances for the authenticated wallet across one or all networks. Returns cached balance data. Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      network: {
        type: 'string',
        description:
          'Optional network filter (e.g. "ethereum", "base"). If omitted, returns balances for all networks.',
      },
      token: {
        type: 'string',
        description:
          'Optional token filter (e.g. "USDT"). If omitted, returns all token balances.',
      },
    },
  },
}

// ─── Handlers ───────────────────────────────────────────────────────

export async function handleGetBalance(
  args: { network?: string; token?: string },
  authCtx: McpAuthContext
): Promise<unknown> {
  const address = requireAuth(authCtx)

  // Return supported tokens per network for the authenticated wallet
  const networks = args.network
    ? { [args.network]: ALL_NETWORKS[args.network] }
    : ALL_NETWORKS

  const info = Object.entries(networks)
    .filter(([, config]) => config && !config.isTestnet)
    .map(([id, config]) => {
      const tokens = (NETWORK_TOKENS[id] || [])
        .filter((t) => !args.token || t.symbol.toUpperCase() === args.token?.toUpperCase())
        .map((t) => ({
          symbol: t.symbol,
          address: t.address,
        }))

      return {
        network: id,
        name: config.name,
        tokens,
      }
    })
    .filter((n) => n.tokens.length > 0)

  return {
    address,
    message:
      'Showing supported tokens per network. On-chain balance queries require an RPC call — use the supported token addresses to query balances directly.',
    supported_tokens: info,
  }
}
