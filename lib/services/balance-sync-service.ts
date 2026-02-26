/**
 * On-Chain Balance Sync Service (链上余额同步)
 *
 * Server-side service that reads real on-chain balances via viem (EVM)
 * and TronGrid HTTP API (TRON), then syncs them to the UserBalance ledger table.
 *
 * Chains sourced from unified config: lib/networks.ts
 * Supported: Ethereum, Polygon, Arbitrum, Base, Optimism, BSC, HashKey Chain, TRON
 */

import { getClient } from "@/lib/prisma"
import { createPublicClient, http, formatUnits, defineChain, type Address, type Chain } from "viem"
import { mainnet, polygon, arbitrum, base, optimism, bsc } from "viem/chains"

import {
  EVM_NETWORKS,
  TRON_NETWORKS,
  NETWORK_TOKENS,
  type NetworkConfig,
  type TokenConfig,
} from "@/lib/networks"

// ─── HashKey Chain Definition (not in viem built-ins) ───────────────────────

const hashkeyChain = defineChain({
  id: 177,
  name: "HashKey Chain",
  nativeCurrency: { name: "HashKey Coin", symbol: "HSK", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://mainnet.hsk.xyz"] },
  },
  blockExplorers: {
    default: { name: "HashKey Explorer", url: "https://hashkey.blockscout.com" },
  },
})

// ─── Chain & Token Configuration (derived from lib/networks.ts) ─────────────

/** Map network ID → viem Chain object */
const VIEM_CHAIN_MAP: Record<string, Chain> = {
  ethereum: mainnet,
  polygon: polygon,
  arbitrum: arbitrum,
  base: base,
  optimism: optimism,
  bsc: bsc,
  hashkey: hashkeyChain,
}

/** RPC overrides (use reliable public RPCs; env vars allow customization) */
const RPC_OVERRIDES: Record<string, string> = {
  ethereum: process.env.RPC_ETHEREUM || "https://eth.llamarpc.com",
  polygon: process.env.RPC_POLYGON || "https://polygon.llamarpc.com",
  arbitrum: process.env.RPC_ARBITRUM || "https://arbitrum.llamarpc.com",
  base: process.env.RPC_BASE || "https://base.llamarpc.com",
  optimism: process.env.RPC_OPTIMISM || "https://optimism.llamarpc.com",
  bsc: process.env.RPC_BSC || "https://bsc-dataseed.binance.org",
  hashkey: process.env.RPC_HASHKEY || "https://mainnet.hsk.xyz",
}

/** Build EVM chain entries from networks.ts config */
const EVM_CHAINS = Object.values(EVM_NETWORKS)
  .filter((n) => !n.isTestnet)
  .map((n) => ({
    network: n,
    chain: VIEM_CHAIN_MAP[n.id],
    name: n.id,
    rpc: RPC_OVERRIDES[n.id] || n.rpcUrl,
  }))
  .filter((entry) => entry.chain) // Only include chains with viem definitions

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

// ─── TRON Configuration ─────────────────────────────────────────────────────

const TRON_RPC = process.env.TRON_FULL_HOST || "https://api.trongrid.io"
const TRON_API_KEY = process.env.TRON_API_KEY || ""

/** TRC20 token configs from networks.ts */
const TRON_TOKEN_LIST: TokenConfig[] = NETWORK_TOKENS["tron"] || []

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OnChainBalance {
  token: string
  chain: string
  balance: string // Formatted (human-readable)
  rawBalance: bigint
}

export interface SyncResult {
  address: string
  synced: number
  errors: string[]
  chains: string[]
}

// ─── Core Operations ────────────────────────────────────────────────────────

/**
 * Detect if an address is TRON (T prefix, 34 chars, Base58)
 */
function isTronAddress(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
}

/**
 * Fetch all on-chain balances for an address (EVM + TRON auto-detect).
 * For EVM addresses, scans ALL supported EVM chains in parallel.
 * For TRON addresses, queries TronGrid API.
 */
export async function fetchOnChainBalances(
  address: string,
  chains?: string[] // Optional: limit to specific chains
): Promise<OnChainBalance[]> {
  if (isTronAddress(address)) {
    return fetchTronBalances(address)
  }
  return fetchEvmBalances(address, chains)
}

/**
 * Fetch TRON balances (TRX native + all TRC20 tokens from config)
 */
async function fetchTronBalances(address: string): Promise<OnChainBalance[]> {
  const balances: OnChainBalance[] = []
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (TRON_API_KEY) {
    headers["TRON-PRO-API-KEY"] = TRON_API_KEY
  }

  // 1. Native TRX balance
  try {
    const resp = await fetch(`${TRON_RPC}/v1/accounts/${address}`, { headers })
    if (resp.ok) {
      const data = await resp.json()
      const account = data.data?.[0]
      if (account?.balance) {
        const trxBalance = account.balance // in sun (1 TRX = 1e6 sun)
        balances.push({
          token: "TRX",
          chain: "tron",
          balance: (trxBalance / 1e6).toString(),
          rawBalance: BigInt(trxBalance),
        })
      }
    }
  } catch (e) {
    console.warn("[BalanceSync] Failed TRX native balance:", e)
  }

  // 2. TRC20 token balances — iterate all tokens from NETWORK_TOKENS["tron"]
  for (const tokenConfig of TRON_TOKEN_LIST) {
    const symbol = tokenConfig.symbol
    try {
      // Primary: try the TronGrid tokens endpoint
      const resp = await fetch(
        `${TRON_RPC}/v1/accounts/${address}/tokens?token_id=${tokenConfig.address}&limit=1`,
        { headers }
      )

      if (resp.ok) {
        const data = await resp.json()
        const tokenData = data.data?.[0]
        if (tokenData) {
          const rawValue = tokenData.balance || tokenData.value || "0"
          const rawBigInt = BigInt(rawValue)
          if (rawBigInt > 0n) {
            const formatted = Number(rawBigInt) / Math.pow(10, tokenConfig.decimals)
            balances.push({
              token: symbol,
              chain: "tron",
              balance: formatted.toString(),
              rawBalance: rawBigInt,
            })
          }
        }
      }

      // Fallback: triggerConstantContract for accurate balanceOf
      if (!balances.find((b) => b.token === symbol && b.chain === "tron")) {
        const balanceResult = await fetchTrc20BalanceOf(address, tokenConfig.address, headers)
        if (balanceResult !== null && balanceResult > 0n) {
          const formatted = Number(balanceResult) / Math.pow(10, tokenConfig.decimals)
          balances.push({
            token: symbol,
            chain: "tron",
            balance: formatted.toString(),
            rawBalance: balanceResult,
          })
        }
      }
    } catch {
      // Skip failed tokens
    }
  }

  return balances
}

/**
 * Call TRC20 balanceOf via triggerConstantContract (server-side, no TronWeb needed)
 */
async function fetchTrc20BalanceOf(
  ownerAddress: string,
  contractAddress: string,
  headers: Record<string, string>
): Promise<bigint | null> {
  try {
    const resp = await fetch(`${TRON_RPC}/wallet/triggersmartcontract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        owner_address: ownerAddress,
        contract_address: contractAddress,
        function_selector: "balanceOf(address)",
        parameter: "", // visible=true lets API handle address encoding
        visible: true,
      }),
    })

    if (!resp.ok) return null

    const data = await resp.json()
    const result = data.constant_result?.[0]
    if (!result) return null

    return BigInt("0x" + result)
  } catch {
    return null
  }
}

/**
 * Fetch EVM balances across ALL supported mainnet chains.
 * Uses NETWORK_TOKENS from lib/networks.ts for token addresses.
 */
async function fetchEvmBalances(
  address: string,
  limitChains?: string[]
): Promise<OnChainBalance[]> {
  const balances: OnChainBalance[] = []
  const addr = address as Address

  const targetChains = limitChains
    ? EVM_CHAINS.filter((c) => limitChains.includes(c.name))
    : EVM_CHAINS

  const chainPromises = targetChains.map(async ({ chain, name, rpc, network }) => {
    const client = createPublicClient({
      chain,
      transport: http(rpc),
    })

    // Native token balance
    try {
      const nativeBalance = await client.getBalance({ address: addr })
      if (nativeBalance > 0n) {
        balances.push({
          token: network.nativeCurrency.symbol,
          chain: name,
          balance: formatUnits(nativeBalance, network.nativeCurrency.decimals),
          rawBalance: nativeBalance,
        })
      }
    } catch (e) {
      console.warn(`[BalanceSync] Failed native balance on ${name}:`, e)
    }

    // ERC20 token balances from NETWORK_TOKENS config
    const tokens = NETWORK_TOKENS[name] || []
    for (const tokenConfig of tokens) {
      try {
        const tokenBalance = await client.readContract({
          address: tokenConfig.address as Address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [addr],
        })

        if (tokenBalance && tokenBalance > 0n) {
          balances.push({
            token: tokenConfig.symbol,
            chain: name,
            balance: formatUnits(tokenBalance, tokenConfig.decimals),
            rawBalance: tokenBalance,
          })
        }
      } catch {
        // Skip tokens that fail (contract may not exist on this chain)
      }
    }
  })

  await Promise.all(chainPromises)
  return balances
}

// ─── Sync to Database ───────────────────────────────────────────────────────

/**
 * Sync on-chain balances to the UserBalance ledger table.
 * Updates `total` and `available` (non-locked portion) for each token/chain.
 */
export async function syncUserBalances(
  userAddress: string,
  chains?: string[]
): Promise<SyncResult> {
  const prisma = getClient()
  const onChainBalances = await fetchOnChainBalances(userAddress, chains)
  const errors: string[] = []
  let synced = 0
  const syncedChains = new Set<string>()

  for (const ob of onChainBalances) {
    try {
      const onChainAmount = parseFloat(ob.balance)
      syncedChains.add(ob.chain)

      // Upsert the balance record
      const existing = await prisma.userBalance.findUnique({
        where: {
          user_address_token_chain: {
            user_address: userAddress,
            token: ob.token,
            chain: ob.chain,
          },
        },
      })

      if (existing) {
        // Preserve locked amount, recalculate available
        const locked = parseFloat(existing.locked.toString())
        const newAvailable = Math.max(onChainAmount - locked, 0)

        await prisma.userBalance.update({
          where: {
            user_address_token_chain: {
              user_address: userAddress,
              token: ob.token,
              chain: ob.chain,
            },
          },
          data: {
            total: onChainAmount,
            available: newAvailable,
            last_synced: new Date(),
            version: { increment: 1 },
          },
        })
      } else {
        await prisma.userBalance.create({
          data: {
            user_address: userAddress,
            token: ob.token,
            chain: ob.chain,
            total: onChainAmount,
            available: onChainAmount,
            locked: 0,
            last_synced: new Date(),
          },
        })
      }

      synced++
    } catch (e: any) {
      errors.push(`${ob.token}/${ob.chain}: ${e.message}`)
    }
  }

  return { address: userAddress, synced, errors, chains: [...syncedChains] }
}

// ─── Single Token Lookup ────────────────────────────────────────────────────

/**
 * Get on-chain balance for a specific token/chain.
 * Supports both EVM and TRON chains.
 * Used by settlement reconciliation.
 */
export async function getOnChainBalance(
  address: string,
  token: string,
  chain: string
): Promise<string | null> {
  // ─── TRON ───
  if (chain === "tron" || chain === "tron-nile") {
    return getTronOnChainBalance(address, token, chain)
  }

  // ─── EVM ───
  const evmEntry = EVM_CHAINS.find((c) => c.name === chain)
  if (!evmEntry) return null

  const client = createPublicClient({
    chain: evmEntry.chain,
    transport: http(evmEntry.rpc),
  })

  const addr = address as Address

  // Native tokens
  const nativeSymbol = evmEntry.network.nativeCurrency.symbol
  if (token === nativeSymbol) {
    try {
      const balance = await client.getBalance({ address: addr })
      return formatUnits(balance, evmEntry.network.nativeCurrency.decimals)
    } catch {
      return null
    }
  }

  // ERC20 — find from NETWORK_TOKENS
  const tokens = NETWORK_TOKENS[chain] || []
  const tokenConfig = tokens.find((t) => t.symbol === token)
  if (!tokenConfig) return null

  try {
    const balance = await client.readContract({
      address: tokenConfig.address as Address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [addr],
    })
    return formatUnits(balance, tokenConfig.decimals)
  } catch {
    return null
  }
}

/**
 * Get on-chain balance for TRON token (TRX native or TRC20)
 */
async function getTronOnChainBalance(
  address: string,
  token: string,
  chain: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }
  if (TRON_API_KEY) {
    headers["TRON-PRO-API-KEY"] = TRON_API_KEY
  }

  const rpc = chain === "tron-nile"
    ? "https://nile.trongrid.io"
    : TRON_RPC

  // Native TRX
  if (token === "TRX") {
    try {
      const resp = await fetch(`${rpc}/v1/accounts/${address}`, { headers })
      if (!resp.ok) return null
      const data = await resp.json()
      const account = data.data?.[0]
      if (!account?.balance) return "0"
      return (account.balance / 1e6).toString()
    } catch {
      return null
    }
  }

  // TRC20 — find from NETWORK_TOKENS
  const tronTokens = NETWORK_TOKENS[chain] || []
  const tokenConfig = tronTokens.find((t) => t.symbol === token)
  if (!tokenConfig) return null

  // Try triggerConstantContract for accurate read
  const balance = await fetchTrc20BalanceOf(address, tokenConfig.address, headers)
  if (balance === null) return null
  return (Number(balance) / Math.pow(10, tokenConfig.decimals)).toString()
}

// ─── Utility: List All Supported Chains & Tokens ────────────────────────────

/**
 * Get a summary of all supported chains and their tokens for the sync service.
 * Useful for API/UI display.
 */
export function getSupportedSyncTargets(): {
  chain: string
  type: "EVM" | "TRON"
  nativeToken: string
  tokens: string[]
}[] {
  const targets: { chain: string; type: "EVM" | "TRON"; nativeToken: string; tokens: string[] }[] = []

  for (const entry of EVM_CHAINS) {
    const tokens = (NETWORK_TOKENS[entry.name] || []).map((t) => t.symbol)
    targets.push({
      chain: entry.name,
      type: "EVM",
      nativeToken: entry.network.nativeCurrency.symbol,
      tokens,
    })
  }

  // TRON mainnet
  targets.push({
    chain: "tron",
    type: "TRON",
    nativeToken: "TRX",
    tokens: TRON_TOKEN_LIST.map((t) => t.symbol),
  })

  return targets
}
