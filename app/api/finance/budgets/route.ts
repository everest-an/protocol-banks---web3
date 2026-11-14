import { NextResponse, type NextRequest } from "next/server"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

function validMonth(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null
}

export const GET = withAuth(async (request: NextRequest, address: string) => {
  const month = validMonth(new URL(request.url).searchParams.get("month")) ?? currentMonth()
  const budgets = await prisma.financeBudget.findMany({
    where: { owner_address: address.toLowerCase(), month },
    orderBy: { category: "asc" },
  })
  return NextResponse.json({
    month,
    budgets: budgets.map((budget) => ({
      id: budget.id,
      category: budget.category,
      month: budget.month,
      amountUsd: budget.amount_usd,
    })),
  })
})

export const POST = withAuth(async (request: NextRequest, address: string) => {
  const body = await request.json().catch(() => ({}))
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : ""
  const amountUsd = Number(body.amountUsd)
  const month = validMonth(body.month) ?? currentMonth()

  if (!category) return NextResponse.json({ error: "category is required" }, { status: 400 })
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 1_000_000_000) {
    return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 400 })
  }

  const budget = await prisma.financeBudget.upsert({
    where: {
      owner_address_category_month: {
        owner_address: address.toLowerCase(),
        category,
        month,
      },
    },
    create: {
      owner_address: address.toLowerCase(),
      category,
      month,
      amount_usd: Number(amountUsd.toFixed(2)),
    },
    update: { amount_usd: Number(amountUsd.toFixed(2)) },
  })

  return NextResponse.json({
    budget: {
      id: budget.id,
      category: budget.category,
      month: budget.month,
      amountUsd: budget.amount_usd,
    },
  })
})

export const DELETE = withAuth(async (request: NextRequest, address: string) => {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  await prisma.financeBudget.deleteMany({
    where: { id, owner_address: address.toLowerCase() },
  })
  return NextResponse.json({ ok: true })
})
