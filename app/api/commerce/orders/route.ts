import { type NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { commerceFailure } from "@/lib/agent/commerce-http"
import { getOrder, listOrders } from "@/lib/agent/commerce"

export const dynamic = "force-dynamic"

export const GET = withAuth(async (request: NextRequest, owner: string) => {
  try {
    const id = request.nextUrl.searchParams.get("id")
    if (id) return NextResponse.json({ ok: true, order: await getOrder(owner, id) })
    return NextResponse.json({ ok: true, orders: await listOrders(owner) })
  } catch (error) {
    return commerceFailure(error, "commerce/orders")
  }
}, { component: "commerce-orders" })
