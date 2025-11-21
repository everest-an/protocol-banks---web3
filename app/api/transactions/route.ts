import { type NextRequest, NextResponse } from "next/server"

// Token addresses for filtering (Mainnet & Sepolia)
const TOKENS = {
  mainnet: {
    USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    USDC: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    DAI: "0x6b175474e89094c44da98b954eedeac495271d0f",
  },
  sepolia: {
    USDT: "0xaa8e23fb1079ea71e0a56f48a2aa51851d8433d0", // Aave V3 Faucet USDT
    USDC: "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8", // Testnet USDC
    DAI: "0xff34b3d4aee8ddcd6f9afffb6fe49bd371b8a357",
  },
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get("address")
  const chainId = searchParams.get("chainId")

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 })
  }

  // Determine network and API URL
  const isSepolia = chainId === "11155111"
  const baseUrl = isSepolia ? "https://api-sepolia.etherscan.io/api" : "https://api.etherscan.io/api"
  const apiKey = process.env.ETHERSCAN_API_KEY || "DRBERJ8M8CMCNYFDAIMGJ2AYVVW4WIK3Z6"

  try {
    // Fetch ERC20 token transfer events
    const params = new URLSearchParams({
      module: "account",
      action: "tokentx",
      address: address,
      page: "1",
      offset: "100", // Limit to last 100 transactions
      sort: "desc",
      apikey: apiKey,
    })

    const response = await fetch(`${baseUrl}?${params.toString()}`)
    const data = await response.json()

    if (data.status === "0" && data.message !== "No transactions found") {
      throw new Error(data.result || "Failed to fetch transactions")
    }

    const transactions = (data.result || []).map((tx: any) => {
      // Determine token symbol
      let symbol = tx.tokenSymbol
      const tokenAddress = tx.contractAddress.toLowerCase()

      // Normalize symbol for known tokens
      if (isSepolia) {
        if (tokenAddress === TOKENS.sepolia.USDT.toLowerCase()) symbol = "USDT"
        if (tokenAddress === TOKENS.sepolia.USDC.toLowerCase()) symbol = "USDC"
        if (tokenAddress === TOKENS.sepolia.DAI.toLowerCase()) symbol = "DAI"
      } else {
        if (tokenAddress === TOKENS.mainnet.USDT.toLowerCase()) symbol = "USDT"
        if (tokenAddress === TOKENS.mainnet.USDC.toLowerCase()) symbol = "USDC"
        if (tokenAddress === TOKENS.mainnet.DAI.toLowerCase()) symbol = "DAI"
      }

      // Calculate amount (handle decimals)
      const decimals = Number.parseInt(tx.tokenDecimal)
      const amount = Number.parseFloat(tx.value) / Math.pow(10, decimals)

      return {
        id: `ext-${tx.hash}`, // Prefix to avoid collision with Supabase IDs
        tx_hash: tx.hash,
        from_address: tx.from,
        to_address: tx.to,
        token_symbol: symbol,
        amount: amount.toFixed(2),
        amount_usd: amount, // Assuming 1:1 peg for stablecoins
        timestamp: new Date(Number.parseInt(tx.timeStamp) * 1000).toISOString(),
        status: "completed", // Blockchain txs are completed if they appear here
        is_external: true, // Flag to indicate this came from indexer
      }
    })

    // Filter for relevant tokens (USDT/USDC/DAI) if needed, or return all
    // For this app, we mostly care about stablecoins
    const filteredTxs = transactions.filter((tx: any) => ["USDT", "USDC", "DAI"].includes(tx.token_symbol))

    return NextResponse.json({ transactions: filteredTxs })
  } catch (error: any) {
    console.error("Indexer fetch error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
