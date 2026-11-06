import { NextResponse } from "next/server"
import { listServices } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get("limit") || "50", 10)
    return NextResponse.json({
      ok: true,
      services: await listServices({
        category: url.searchParams.get("category"),
        q: url.searchParams.get("q"),
        limit,
      }),
    })
  } catch (error) {
    console.error("[commerce/directory] failed:", error)
    return NextResponse.json({ error: "directory request failed" }, { status: 500 })
  }
}
