import { getTokenUsdPrices } from "../prices"
import type { FinanceLedgerRow } from "../ledger"

const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api"

const CHAINS: Array<{ id: number; name: string; native: string }> = [
  { id: 1, name: "ethereum", native: "ETH" },
  { id: 42161, name: "arbitrum", native: "ETH" },
  { id: 137, name: "polygon", native: "POL" },
]

const BLOCKSCOUT_CHAINS: Array<{ name: string; base: string; native: string }> = [
  { name: "optimism", base: "https://optimism.blockscout.com", native: "ETH" },
]

interface EtherscanTx {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  isError?: string
  transactionIndex?: string
}

interface EtherscanTokenTx extends EtherscanTx {
  tokenSymbol?: string
  tokenDecimal?: string
  contractAddress?: string
}

function enabledNames(): Set<string> | null {
  const configured = process.env.ONCHAIN_HISTORY_CHAINS
  if (!configured) return null
  return new Set(configured.split(",").map((item) => item.trim().toLowerCase()))
}

function enabledChains(): Array<{ id: number; name: string; native: string }> {
  const wanted = enabledNames()
  return wanted ? CHAINS.filter((chain) => wanted.has(chain.name)) : CHAINS
}

function enabledBlockscoutChains(): Array<{ name: string; base: string; native: string }> {
  const wanted = enabledNames()
  return wanted ? BLOCKSCOUT_CHAINS.filter((chain) => wanted.has(chain.name)) : BLOCKSCOUT_CHAINS
}

async function etherscan(
  chainId: number,
  action: "txlist" | "tokentx",
  address: string,
  apiKey: string,
): Promise<Array<EtherscanTx | EtherscanTokenTx>> {
  const url = new URL(ETHERSCAN_V2)
  url.searchParams.set("chainid", String(chainId))
  url.searchParams.set("module", "account")
  url.searchParams.set("action", action)
  url.searchParams.set("address", address)
  url.searchParams.set("page", "1")
  url.searchParams.set("offset", "200")
  url.searchParams.set("sort", "desc")
  url.searchParams.set("apikey", apiKey)

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (!response.ok) return []
  const body = (await response.json()) as { status?: string; result?: unknown }
  return Array.isArray(body.result) ? (body.result as Array<EtherscanTx | EtherscanTokenTx>) : []
}

interface BlockscoutTx {
  hash: string
  from?: { hash?: string }
  to?: { hash?: string }
  value?: string
  timestamp?: string
  status?: string
}

interface BlockscoutTokenTransfer {
  transaction_hash?: string
  from?: { hash?: string }
  to?: { hash?: string }
  total?: { value?: string; decimals?: string }
  token?: { symbol?: string }
  timestamp?: string
  log_index?: number
}

async function blockscout<T>(base: string, path: string, address: string): Promise<T[]> {
  const response = await fetch(`${base}/api/v2/addresses/${address}/${path}`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  if (!response.ok) return []
  const body = (await response.json()) as { items?: unknown }
  return Array.isArray(body.items) ? (body.items as T[]) : []
}

function short(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function tokenAmount(raw: string | undefined, decimals: string | undefined): number {
  if (!raw) return 0
  const value = Number(raw)
  const digits = Number(decimals ?? "18")
  if (!Number.isFinite(value) || !Number.isFinite(digits)) return 0
  return value / 10 ** digits
}

interface RawTransfer {
  chain: string
  native: string
  hash: string
  from: string
  to: string
  symbol: string
  amount: number
  timestamp: Date
  index: string
  nativeTransfer: boolean
}

export async function collectOnchainHistoryRows(walletAddress: string): Promise<FinanceLedgerRow[]> {
  if (process.env.ONCHAIN_HISTORY_ENABLED === "false") return []
  const apiKey = process.env.ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY
  const etherscanChains = apiKey ? enabledChains() : []
  const blockscoutChains = enabledBlockscoutChains()
  if (!etherscanChains.length && !blockscoutChains.length) return []

  const wallet = walletAddress.toLowerCase()
  const perChain = await Promise.all(
    etherscanChains.map(async (chain, index) => {
      if (!apiKey) return []
      await new Promise((resolve) => setTimeout(resolve, index * 250))
      const collected: RawTransfer[] = []
      try {
        const [transactions, tokenTransfers] = await Promise.all([
          etherscan(chain.id, "txlist", wallet, apiKey),
          etherscan(chain.id, "tokentx", wallet, apiKey),
        ])

        for (const tx of transactions as EtherscanTx[]) {
          if (tx.isError === "1") continue
          const amount = tokenAmount(tx.value, "18")
          if (amount <= 0) continue
          const timestamp = new Date(Number(tx.timeStamp) * 1000)
          if (Number.isNaN(timestamp.getTime())) continue
          collected.push({
            chain: chain.name,
            native: chain.native,
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            symbol: chain.native,
            amount,
            timestamp,
            index: tx.transactionIndex ?? "0",
            nativeTransfer: true,
          })
        }

        for (const tx of tokenTransfers as EtherscanTokenTx[]) {
          if (!tx.tokenSymbol) continue
          const amount = tokenAmount(tx.value, tx.tokenDecimal)
          if (amount <= 0) continue
          const timestamp = new Date(Number(tx.timeStamp) * 1000)
          if (Number.isNaN(timestamp.getTime())) continue
          collected.push({
            chain: chain.name,
            native: chain.native,
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            symbol: tx.tokenSymbol,
            amount,
            timestamp,
            index: tx.transactionIndex ?? "0",
            nativeTransfer: false,
          })
        }
      } catch (error) {
        console.warn(`[onchain-history] ${chain.name} failed:`, error instanceof Error ? error.message : error)
      }
      return collected
    }),
  )
  const perBlockscout = await Promise.all(
    blockscoutChains.map(async (chain) => {
      const collected: RawTransfer[] = []
      try {
        const [transactions, tokenTransfers] = await Promise.all([
          blockscout<BlockscoutTx>(chain.base, "transactions", wallet),
          blockscout<BlockscoutTokenTransfer>(chain.base, "token-transfers", wallet),
        ])

        for (const tx of transactions) {
          if (tx.status && tx.status !== "ok") continue
          const amount = tokenAmount(tx.value, "18")
          if (amount <= 0 || !tx.from?.hash || !tx.to?.hash || !tx.timestamp) continue
          const timestamp = new Date(tx.timestamp)
          if (Number.isNaN(timestamp.getTime())) continue
          collected.push({
            chain: chain.name,
            native: chain.native,
            hash: tx.hash,
            from: tx.from.hash,
            to: tx.to.hash,
            symbol: chain.native,
            amount,
            timestamp,
            index: "0",
            nativeTransfer: true,
          })
        }

        for (const tx of tokenTransfers) {
          if (!tx.transaction_hash || !tx.from?.hash || !tx.to?.hash || !tx.timestamp) continue
          const amount = tokenAmount(tx.total?.value, tx.total?.decimals)
          if (amount <= 0 || !tx.token?.symbol) continue
          const timestamp = new Date(tx.timestamp)
          if (Number.isNaN(timestamp.getTime())) continue
          collected.push({
            chain: chain.name,
            native: chain.native,
            hash: tx.transaction_hash,
            from: tx.from.hash,
            to: tx.to.hash,
            symbol: tx.token.symbol,
            amount,
            timestamp,
            index: String(tx.log_index ?? "0"),
            nativeTransfer: false,
          })
        }
      } catch (error) {
        console.warn(`[onchain-history] ${chain.name} failed:`, error instanceof Error ? error.message : error)
      }
      return collected
    }),
  )
  const collected = [...perChain.flat(), ...perBlockscout.flat()]

  const prices = await getTokenUsdPrices(collected.map((item) => item.symbol))
  const rows: FinanceLedgerRow[] = []

  for (const item of collected) {
    const price = prices[item.symbol.toUpperCase()]
    if (!price || !Number.isFinite(price)) continue
    const amountUsd = Number((item.amount * price).toFixed(2))
    if (amountUsd < 0.01) continue

    const incoming = item.to.toLowerCase() === wallet && item.from.toLowerCase() !== wallet
    const outgoing = item.from.toLowerCase() === wallet && item.to.toLowerCase() !== wallet
    if (!incoming && !outgoing) continue

    const dedupeKey = item.nativeTransfer
      ? `onchain:${item.chain}:${item.hash}:${item.symbol}:native`
      : `onchain:${item.chain}:${item.hash}:${item.symbol}:${item.index}`

    rows.push({
      source: "onchain",
      source_id: `${item.chain}:${item.hash}:${item.symbol}:${item.index}`,
      dedupe_key: dedupeKey,
      kind: "transfer",
      direction: incoming ? "in" : "out",
      category: "On-chain transfer",
      counterparty: short(incoming ? item.from : item.to),
      description: `${item.amount.toFixed(6)} ${item.symbol} ${incoming ? "received" : "sent"} on ${item.chain}`,
      amount_usd: amountUsd,
      currency: "USD",
      occurred_at: item.timestamp,
      status: "completed",
      metadata: {
        chain: item.chain,
        txHash: item.hash,
        token: item.symbol,
        tokenAmount: item.amount,
        priceUsd: price,
        native: item.nativeTransfer,
      },
    })
  }

  return rows
}
