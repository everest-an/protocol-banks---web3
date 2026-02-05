import { type NextRequest, NextResponse } from "next/server"

// Rango API key should be set in environment variables
const RANGO_API_KEY = process.env.RANGO_API_KEY
const BASE_URL = "https://api.rango.exchange"

export async function POST(request: NextRequest) {
  if (!RANGO_API_KEY) {
    console.error("RANGO_API_KEY is missing from environment variables")
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
  }

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

    const url = new URL(`${BASE_URL}${endpoint}`)
    url.searchParams.set("apiKey", RANGO_API_KEY)

    if (method === "GET" && params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) url.searchParams.set(key, String(value))
      })
    }

    const response = await fetch(url.toString(), {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(params) : undefined,
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Rango API error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "API request failed" }, { status: 500 })
  }
}
