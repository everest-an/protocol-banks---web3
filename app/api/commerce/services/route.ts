import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { createService, listOwnedServices } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (_request: NextRequest, owner: string) => {
  try {
    return NextResponse.json({ ok: true, services: await listOwnedServices(owner) })
  } catch (error) {
    return commerceFailure(error, "commerce/services")
  }
}, { component: "commerce-services" })

export const POST = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const body = await request.json()
    return NextResponse.json({ ok: true, service: await createService(owner, undefined, body) }, { status: 201 })
  } catch (error) {
    return commerceFailure(error, "commerce/services")
  }
}, { component: "commerce-services" })
