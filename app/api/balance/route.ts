import { NextResponse } from "next/server"
import { createPublicClient, fallback, http, formatUnits, isAddress, parseAbi } from "viem"
import { arbitrum, base, bsc, mainnet, optimism, polygon } from "viem/chains"

const erc20Abi = parseAbi(["function balanceOf(address) view returns (uint256)"])

const CHAINS = [
  { chain: mainnet, name: "Ethereum", nativeSymbol: "ETH", rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.merkle.io"] },
  { chain: polygon, name: "Polygon", nativeSymbol: "MATIC", rpcs: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"] },
  { chain: arbitrum, name: "Arbitrum", nativeSymbol: "ETH", rpcs: ["https://arb1.arbitrum.io/rpc", "https://arbitrum-one-rpc.publicnode.com"] },
  { chain: base, name: "Base", nativeSymbol: "ETH", rpcs: ["https://mainnet.base.org", "https://base.publicnode.com"] },
  { chain: optimism, name: "Optimism", nativeSymbol: "ETH", rpcs: ["https://mainnet.optimism.io", "https://optimism-rpc.publicnode.com"] },
  { chain: bsc, name: "BNB Chain", nativeSymbol: "BNB", rpcs: ["https://bsc-rpc.publicnode.com", "https://bsc-dataseed.binance.org"] },
]

const TOKENS: Record<string, { decimals: number; addresses: Record<number, string> }> = {
  USDC: {
    decimals: 6,
    addresses: {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
  },
  USDT: {
    decimals: 6,
    addresses: {
      1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      56: "0x55d398326f99059fF775485246999027B3197955",
    },
  },
  DAI: {
    decimals: 18,
    addresses: {
      1: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      137: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
      42161: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
      10: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    },
  },
  WETH: {
    decimals: 18,
    addresses: {
      137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
      42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      8453: "0x4200000000000000000000000000000000000006",
      10: "0x4200000000000000000000000000000000000006",
    },
  },
  WBTC: {
    decimals: 8,
    addresses: {
      1: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
      137: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      42161: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    },
  },
}

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address")
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: "valid address is required" }, { status: 400 })
  }

  const tokens: Array<{ token: string; chain: string; balance: string; contractAddress?: string }> = []
  const failures: string[] = []
  const work = CHAINS.map(async ({ chain, name, nativeSymbol, rpcs }) => {
    try {
      const client = createPublicClient({
        chain,
        transport: fallback(rpcs.map((rpc) => http(rpc, { timeout: 8000 }))),
      })
      const native = await client.getBalance({ address: address as `0x${string}` })
      if (native > 0n) tokens.push({ token: nativeSymbol, chain: name, balance: formatUnits(native, 18) })
      for (const [symbol, info] of Object.entries(TOKENS)) {
        const contract = info.addresses[chain.id]
        if (!contract) continue
        try {
          const value = await client.readContract({
            address: contract as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address as `0x${string}`],
          })
          if (value > 0n) tokens.push({ token: symbol, chain: name, balance: formatUnits(value, info.decimals), contractAddress: contract })
        } catch {
          // one token failing must not blank the chain
        }
      }
    } catch {
      failures.push(name)
    }
  })

  await Promise.race([
    Promise.all(work),
    new Promise<void>((resolve) => setTimeout(resolve, 12_000)),
  ])

  if (tokens.length === 0 && failures.length > 0) {
    return NextResponse.json({ error: `balance RPCs unavailable: ${failures.join(", ")}` }, { status: 502 })
  }

  return NextResponse.json(
    { tokens, failures },
    { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" } },
  )
}
