/**
 * MCP Resources
 *
 * Read-only resources that expose static configuration data
 * to MCP clients. Resources don't require authentication.
 *
 * @module lib/mcp/resources
 */

import { ALL_NETWORKS, NETWORK_TOKENS, getMainnetNetworks } from '@/lib/networks'

// ─── Resource Definitions ───────────────────────────────────────────

export const networkListResource = {
  name: 'network-list',
  uri: 'protocol-banks://networks',
  metadata: {
    description: 'List of all supported blockchain networks with RPC endpoints and chain IDs.',
    mimeType: 'application/json',
  },
}

export const tokenListResource = {
  name: 'token-list',
  uri: 'protocol-banks://tokens',
  metadata: {
    description: 'List of all supported tokens per network with contract addresses and decimals.',
    mimeType: 'application/json',
  },
}

// ─── Resource Handlers ──────────────────────────────────────────────

export async function handleNetworkListResource(): Promise<unknown> {
  const networks = Object.entries(ALL_NETWORKS).map(([id, config]) => ({
    id,
    name: config.name,
    type: config.type,
    chain_id: config.chainId,
    native_currency: config.nativeCurrency,
    rpc_url: config.rpcUrl,
    block_explorer: config.blockExplorer,
    is_testnet: config.isTestnet,
  }))

  return { networks, total: networks.length }
}

export async function handleTokenListResource(): Promise<unknown> {
  const mainnetNetworks = getMainnetNetworks()
  const result = mainnetNetworks.map((config) => {
    const tokens = NETWORK_TOKENS[config.id] || []
    return {
      network: config.id,
      network_name: config.name,
      tokens: tokens.map((t) => ({
        symbol: t.symbol,
        address: t.address,
        decimals: t.decimals,
      })),
    }
  })

  return { token_lists: result }
}
