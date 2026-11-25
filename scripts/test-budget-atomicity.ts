/**
 * Integration test: two concurrent debits cannot overspend a budget.
 *
 * Requires a disposable PostgreSQL database with the Prisma schema applied:
 *   TEST_DATABASE_URL=postgres://... npx prisma db push
 *   TEST_DATABASE_URL=postgres://... npm run test:db:budget
 *
 * This touches only rows created by the test and deletes them afterwards.
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

async function main() {
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    console.error("TEST_DATABASE_URL is required (use a disposable database, never production)")
    process.exit(2)
  }
  process.env.DATABASE_URL = url
  process.env.DIRECT_DATABASE_URL = url

  const { prisma } = await import("@/lib/prisma")
  const { budgetService, setUseDatabaseStorage } = await import("@/lib/services/budget-service")
  setUseDatabaseStorage(true)

  const owner = "0x1234567890123456789012345678901234567890"
  const agent = await prisma.agent.create({
    data: {
      owner_address: owner,
      name: "Budget Atomicity Integration Test",
      api_key_hash: `test-${randomUUID()}`,
      api_key_prefix: "test",
    },
  })

  const budget = await prisma.agentBudget.create({
    data: {
      agent_id: agent.id,
      owner_address: owner,
      amount: "100",
      token: "USDC",
      period: "monthly",
      used_amount: "0",
      remaining_amount: "100",
      period_start: new Date(),
    },
  })

  try {
    const results = await Promise.allSettled([
      budgetService.deductBudget(budget.id, "80"),
      budgetService.deductBudget(budget.id, "80"),
    ])
    const fulfilled = results.filter((r) => r.status === "fulfilled")
    const rejected = results.filter((r) => r.status === "rejected")

    assert.equal(fulfilled.length, 1, "exactly one debit should win")
    assert.equal(rejected.length, 1, "exactly one debit should lose")
    assert.match(
      String((rejected[0] as PromiseRejectedResult).reason?.message ?? ""),
      /Insufficient budget/i,
    )

    const afterDebits = await prisma.agentBudget.findUnique({ where: { id: budget.id } })
    assert.equal(Number(afterDebits?.used_amount), 80)
    assert.equal(Number(afterDebits?.remaining_amount), 20)

    await budgetService.refundBudget(budget.id, "30")
    const afterRefund = await prisma.agentBudget.findUnique({ where: { id: budget.id } })
    assert.equal(Number(afterRefund?.used_amount), 50)
    assert.equal(Number(afterRefund?.remaining_amount), 50)

    console.log("OK: one debit won, one was rejected, refund restored the balance")
  } finally {
    await prisma.agentBudget.delete({ where: { id: budget.id } }).catch(() => {})
    await prisma.agent.delete({ where: { id: agent.id } }).catch(() => {})
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
