import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedAddress, getRequestAccessMode } from "@/lib/api-auth"

const BASE_URL = "https://api.rango.exchange"

type ApiMode = "demo" | "real"

function getRouteConfig(mode: ApiMode) {
  if (mode === "demo") {
    return {
      apiKey: process.env.RANGO_DEV_API_KEY || process.env.RANGO_API_KEY || "",
      allowMockFallback: true,
    }
  }

  return {
    apiKey: process.env.RANGO_API_KEY || "",
    allowMockFallback: false,
  }
}

function buildMockResponse(action: string, params: Record<string, any>) {
  const now = Date.now()
  const amount = Number.parseFloat(params.amount || "1")
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 1
  const outputA = (safeAmount * 0.9975).toFixed(6)
  const outputB = (safeAmount * 0.9942).toFixed(6)
  const from = params.from || { blockchain: "ETH", symbol: "USDC", address: null }
  const to = params.to || { blockchain: "POLYGON", symbol: "USDC", address: null }

  switch (action) {
    case "getAllRoutes": {
      return {
        routeId: `mock-route-${now}`,
        results: [
          {
            requestId: `mock-req-${now}-a`,
            outputAmount: outputA,
            swaps: [
              {
                swapperId: "RangoDemoFast",
                swapperLogo: "",
                swapperType: "AGGREGATOR",
                from,
                to,
                fromAmount: safeAmount.toString(),
                toAmount: outputA,
                fee: [
                  {
                    name: "network",
                    amount: "0.12",
                    asset: { ...from, usdPrice: 1 },
                    expenseType: "FROM_SOURCE_WALLET",
                    usdPrice: 0.12,
                  },
                ],
                estimatedTimeInSeconds: 95,
              },
            ],
            tags: [{ label: "Demo", value: "RECOMMENDED" }],
          },
          {
            requestId: `mock-req-${now}-b`,
            outputAmount: outputB,
            swaps: [
              {
                swapperId: "RangoDemoLowFee",
                swapperLogo: "",
                swapperType: "DEX",
                from,
                to,
                fromAmount: safeAmount.toString(),
                toAmount: outputB,
                fee: [
                  {
                    name: "service",
                    amount: "0.05",
                    asset: { ...from, usdPrice: 1 },
                    expenseType: "DECREASE_FROM_OUTPUT",
                    usdPrice: 0.05,
                  },
                ],
                estimatedTimeInSeconds: 210,
              },
            ],
            tags: [{ label: "Demo", value: "LOWEST_FEE" }],
          },
        ],
        source: "mock",
      }
    }
    case "confirmRoute":
      return {
        ok: true,
        requestId: params.requestId,
        routeId: params.routeId,
        source: "mock",
      }
    case "createTransaction":
      return {
        hash: `0xmock${now.toString(16)}`,
        txId: `mock-tx-${now}`,
        status: "pending",
        source: "mock",
      }
    case "checkStatus":
      return {
        status: "success",
        txId: params.txId || `mock-tx-${now}`,
        source: "mock",
      }
    default:
      return { error: "Invalid action" }
  }
}

export async function POST(request: NextRequest) {
  const callerAddress = await getAuthenticatedAddress(request)
  const isAuthenticated = !!callerAddress
  const isTestMode = request.headers.get("x-test-mode") === "true"
  const mode = await getRequestAccessMode(request)
  const config = getRouteConfig(mode)

  if (isAuthenticated && isTestMode) {
    console.info("[Rango] Ignoring test mode for authenticated user; forcing real API mode")
  }

  if (mode === "real" && !config.apiKey) {
    return NextResponse.json(
      {
        error: "Missing real Rango API configuration",
        message: "Real mode requires RANGO_API_KEY. Please provide your real API key/env.",
      },
      { status: 500 },
    )
  }

  const requestClone = request.clone()

  try {
    const { action, ...params } = await request.json()

    let endpoint = ""
    let method = "POST"

    switch (action) {
      case "getAllRoutes":
        endpoint = "/routing/bests"
        break
      case "confirmRoute":
        endpoint = "/routing/confirm"
        break
      case "createTransaction":
        endpoint = "/tx/create"
        break
      case "checkStatus":
        endpoint = "/tx/check-status"
        method = "GET"
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    if (!endpoint) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const url = new URL(`${BASE_URL}${endpoint}`)
    if (config.apiKey) {
      url.searchParams.set("apiKey", config.apiKey)
    }

    if (method === "GET" && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value))
      })
    }

    if (mode === "demo" && !config.apiKey) {
      return NextResponse.json(buildMockResponse(action, params))
    }

    const response = await fetch(url.toString(), {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(params) : undefined,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const status = response.status
      const upstreamMessage = data?.message || data?.error || "Upstream Rango API request failed"

      if (mode === "demo" && config.allowMockFallback) {
        console.warn(`[Rango][Demo] Upstream failed (${status}), fallback to mock data: ${upstreamMessage}`)
        return NextResponse.json(buildMockResponse(action, params))
      }

      if (mode === "real" && (status === 401 || status === 403)) {
        return NextResponse.json(
          {
            error: "Real Rango API unauthorized",
            message: "RANGO_API_KEY or related env is invalid. Please provide your real API credentials.",
            upstream: upstreamMessage,
          },
          { status: 502 },
        )
      }

      return NextResponse.json(
        {
          error: "Rango upstream request failed",
          message: upstreamMessage,
        },
        { status: 502 },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Rango API error:", error)
    if (mode === "demo") {
      try {
        const body = await requestClone.json().catch(() => ({ action: "getAllRoutes" }))
        return NextResponse.json(buildMockResponse(body.action, body))
      } catch {
        return NextResponse.json(buildMockResponse("getAllRoutes", {}))
      }
    }
    return NextResponse.json(
      {
        error: "API request failed",
        message: "Please provide your real API key/env if you want real mode.",
      },
      { status: 500 },
    )
  }
}
