import { NextResponse } from "next/server"
import { CommerceError } from "@/lib/agent/commerce"

export function commerceFailure(error: unknown, label: string) {
  if (error instanceof CommerceError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(`[${label}] failed:`, error)
  return NextResponse.json({ error: "commerce request failed" }, { status: 500 })
}
