/**
 * What partners owe: executed orders and fees per wallet.
 * Run: DAYS=30 npx tsx -r dotenv/config scripts/partner-usage.ts
 */
import { prisma } from "../lib/prisma"

const DAYS = Number(process.env.DAYS || 30)

async function main() {
  const since = new Date(Date.now() - DAYS * 86_400_000)
  const rows = await prisma.usageEvent.findMany({
    where: { name: "agent_op", created_at: { gte: since } },
    select: { wallet: true, props: true },
  })

  const byWallet = new Map<string, { orders: number; notional: number; fee: number }>()
  for (const row of rows) {
    const props = (row.props ?? {}) as { notional?: number; fee?: number }
    const key = row.wallet ?? "unknown"
    const entry = byWallet.get(key) ?? { orders: 0, notional: 0, fee: 0 }
    entry.orders += 1
    entry.notional += Number(props.notional ?? 0)
    entry.fee += Number(props.fee ?? 0)
    byWallet.set(key, entry)
  }

  console.log(`partner orders, last ${DAYS}d: ${rows.length}`)
  for (const [wallet, entry] of [...byWallet].sort((a, b) => b[1].fee - a[1].fee)) {
    console.log(
      `${wallet}  orders=${String(entry.orders).padStart(4)}  notional=$${entry.notional.toFixed(2)}  fees=$${entry.fee.toFixed(4)}`,
    )
  }
  const total = [...byWallet.values()].reduce((a, e) => a + e.fee, 0)
  console.log(`total fees owed: $${total.toFixed(4)}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED", e instanceof Error ? e.message : e)
    process.exit(1)
  })
