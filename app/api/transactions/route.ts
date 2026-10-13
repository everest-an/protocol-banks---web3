import { type NextRequest, NextResponse } from "next/server"
import { validateAndChecksumAddress, sanitizeTextInput } from "@/lib/security/security"
import { addSecurityHeaders, validateOrigin } from "@/lib/security/security-middleware"

// Etherscan V2: one host + one key serves every chain (selected with
// `chainid`). The route used to query a single chain's ERC-20 transfers and
// then filter down to USDT/USDC/DAI — which is why a real wallet's history
// looked empty. It now returns native transfers AND ERC-20 transfers across
// the chains the product supports, newest first.
const ETHERSCAN_V2 = "https://api.etherscan.io/v2/api"

const CHAINS: Array<{ id: string; name: string; native: string }> = [
  { id: "1", name: "ethereum", native: "ETH" },
  { id: "42161", name: "arbitrum", native: "ETH" },
  { id: "8453", name: "base", native: "ETH" },
  { id: "137", name: "polygon", native: "POL" },
  { id: "10", name: "optimism", native: "ETH" },
  { id: "56", name: "bsc", native: "BNB" },
]

interface RawTx {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  tokenSymbol?: string
  tokenDecimal?: string
  contractAddress?: string
  input?: string
  functionName?: string
  methodId?: string
}

async function explorerList(chainId: string, action: "txlist" | "tokentx", address: string, apiKey: string): Promise<RawTx[]> {
  const params = new URLSearchParams({
    chainid: chainId,
    module: "account",
    action,
    address,
    page: "1",
    offset: "50",
    sort: "desc",
    apikey: apiKey,
  })
  try {
    const res = await fetch(`${ETHERSCAN_V2}?${params.toString()}`, { cache: "no-store" })
    const data = await res.json()
    if (!data || data.status === "0") return [] // "No transactions found" or per-chain error
    return Array.isArray(data.result) ? (data.result as RawTx[]) : []
  } catch {
    return [] // one chain failing must not blank the whole history
  }
}

/**
 * PUBLIC endpoint. On-chain history is public blockchain data — every explorer
 * shows it for any address — so it loads without a wallet sign-in. The old
 * auth requirement was inherited friction, not a privacy control (it also
 * silently 401'd whenever a visitor had merely connected, which is why the
 * dashboard looked empty).
 */
export async function GET(request: NextRequest) {
  const originValidation = validateOrigin(request)
  if (!originValidation.valid) {
    return addSecurityHeaders(NextResponse.json({ error: originValidation.error }, { status: 403 }))
  }

  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get("address")
  const chainParam = searchParams.get("chainId")

  if (!address) {
    return addSecurityHeaders(NextResponse.json({ error: "Address is required" }, { status: 400 }))
  }

  const addressValidation = validateAndChecksumAddress(address)
  if (!addressValidation.valid) {
    return addSecurityHeaders(NextResponse.json({ error: addressValidation.error }, { status: 400 }))
  }

  const apiKey = process.env.ETHERSCAN_API_KEY
  if (!apiKey) {
    console.error("[Security] ETHERSCAN_API_KEY not configured")
    return addSecurityHeaders(NextResponse.json({ error: "API configuration error" }, { status: 500 }))
  }

  // "all" (or nothing) = every supported chain; a specific id = that chain only.
  const targets =
    chainParam && chainParam !== "all" ? CHAINS.filter((c) => c.id === chainParam) : CHAINS
  const chainsToQuery = targets.length ? targets : CHAINS

  try {
    const perChain = await Promise.all(
      chainsToQuery.flatMap((chain) => [
        explorerList(chain.id, "txlist", addressValidation.checksummed!, apiKey).then((txs) =>
          txs.map((tx) => ({ tx, chain, kind: "native" as const })),
        ),
        explorerList(chain.id, "tokentx", addressValidation.checksummed!, apiKey).then((txs) =>
          txs.map((tx) => ({ tx, chain, kind: "token" as const })),
        ),
      ]),
    )

    const transactions = perChain
      .flat()
      .map(({ tx, chain, kind }) => {
        const rawValue = Number.parseFloat(tx.value || "0")
        const inputData = tx.input ?? "0x"
        // Native listings carry three things: plain value transfers, token
        // moves (already covered by tokentx) and CONTRACT INTERACTIONS
        // (approve / swap / mint / ... with value 0). Keep real transfers AND
        // contract calls; drop only the token duplicates.
        const isContractCall = kind === "native" && rawValue === 0 && inputData !== "0x"
        if (kind === "native" && rawValue === 0 && !isContractCall) return null
        const txKind = isContractCall ? "contract" : kind
        const symbol = txKind === "native" ? chain.native : tx.tokenSymbol || "TOKEN"
        const parsedDecimals = txKind === "native" ? 18 : Number.parseInt(tx.tokenDecimal ?? "18")
        const decimals = Number.isFinite(parsedDecimals) ? parsedDecimals : 18
        const amount = rawValue / Math.pow(10, decimals)
        const { sanitized: sanitizedSymbol } = sanitizeTextInput(symbol)

        return {
          id: `ext-${chain.id}-${tx.hash}-${txKind}`,
          tx_hash: tx.hash,
          from_address: tx.from,
          to_address: tx.to,
          token_symbol: sanitizedSymbol,
          amount: amount.toFixed(6),
          amount_usd: amount,
          timestamp: new Date(Number.parseInt(tx.timeStamp) * 1000).toISOString(),
          status: "completed",
          is_external: true,
          chain: chain.name,
          chain_id: chain.id,
          tx_type: txKind,
          contract_function: isContractCall ? tx.functionName || tx.methodId || "contract call" : undefined,
        }
      })
      .filter((tx): tx is NonNullable<typeof tx> => tx !== null)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, 120)

    return addSecurityHeaders(
      NextResponse.json({
        transactions,
        chains: chainsToQuery.map((c) => c.name),
        count: transactions.length,
      }),
    )
  } catch (error: unknown) {
    console.error("Indexer fetch error:", error)
    return addSecurityHeaders(NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 }))
  }
}
