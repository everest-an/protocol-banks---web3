import { type NextRequest, NextResponse } from "next/server"

/**
 * x402 Protocol - Main Endpoint
 * 
 * Returns information about the x402 protocol implementation.
 * This follows the HTTP 402 Payment Required standard.
 */

export interface X402InfoResponse {
  protocol: string
  version: string
  supportedTokens: string[]
  supportedChains: { id: number; name: string }[]
  endpoints: {
    authorize: string
    verify: string
    status: string
  }
  documentation: string
}

export async function GET(): Promise<NextResponse<X402InfoResponse>> {
  return NextResponse.json({
    protocol: "x402",
    version: "1.0.0",
    supportedTokens: ["USDC", "USDT", "DAI"],
    supportedChains: [
      { id: 1, name: "Ethereum" },
      { id: 137, name: "Polygon" },
      { id: 10, name: "Optimism" },
      { id: 42161, name: "Arbitrum" },
      { id: 8453, name: "Base" },
    ],
    endpoints: {
      authorize: "/api/x402/authorize",
      verify: "/api/x402/verify",
      status: "/api/x402/status",
    },
    documentation: "https://docs.protocolbanks.com/x402",
  })
}

// Handle 402 Payment Required responses
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case "info":
        return NextResponse.json({
          protocol: "x402",
          version: "1.0.0",
          message: "Use /api/x402/authorize to create a payment authorization",
        })
      
      case "supported-tokens":
        return NextResponse.json({
          tokens: [
            { symbol: "USDC", name: "USD Coin", decimals: 6 },
            { symbol: "USDT", name: "Tether", decimals: 6 },
            { symbol: "DAI", name: "Dai", decimals: 18 },
          ],
        })
      
      case "supported-chains":
        return NextResponse.json({
          chains: [
            { id: 1, name: "Ethereum", rpc: "https://eth.llamarpc.com" },
            { id: 137, name: "Polygon", rpc: "https://polygon.llamarpc.com" },
            { id: 10, name: "Optimism", rpc: "https://optimism.llamarpc.com" },
            { id: 42161, name: "Arbitrum", rpc: "https://arbitrum.llamarpc.com" },
            { id: 8453, name: "Base", rpc: "https://base.llamarpc.com" },
          ],
        })
      
      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'info', 'supported-tokens', or 'supported-chains'" },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    )
  }
}
