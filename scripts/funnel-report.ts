/**
 * The acquisition funnel, from the events table.
 *
 * Run: npx tsx -r dotenv/config scripts/funnel-report.ts
 *   FUNNEL_DAYS=30 npx tsx -r dotenv/config scripts/funnel-report.ts
 */
import { prisma } from "../lib/prisma"

const DAYS = Number(process.env.FUNNEL_DAYS || 30)

async function main() {
  const since = new Date(Date.now() - DAYS * 86_400_000)
  const rows = await prisma.usageEvent.findMany({
    where: { created_at: { gte: since } },
    select: { name: true, anon_id: true, wallet: true, created_at: true },
    orderBy: { created_at: "asc" },
  })

  const byName = new Map<string, { events: number; anons: Set<string>; wallets: Set<string> }>()
  for (const r of rows) {
    const e = byName.get(r.name) ?? { events: 0, anons: new Set<string>(), wallets: new Set<string>() }
    e.events++
    if (r.anon_id) e.anons.add(r.anon_id)
    if (r.wallet) e.wallets.add(r.wallet)
    byName.set(r.name, e)
  }

  console.log(`window: last ${DAYS} days · ${rows.length} events\n`)
  console.log("event".padEnd(18), "events".padStart(7), "visitors".padStart(9), "wallets".padStart(8))
  for (const [name, e] of [...byName].sort((a, b) => b[1].events - a[1].events)) {
    console.log(name.padEnd(18), String(e.events).padStart(7), String(e.anons.size).padStart(9), String(e.wallets.size).padStart(8))
  }

  const funnel: Array<[string, "anons" | "wallets"]> = [
    ["landing_view", "anons"],
    ["cockpit_view", "anons"],
    ["wallet_bound", "wallets"],
    ["live_approved", "wallets"],
    ["trade_opened", "wallets"],
  ]
  console.log("\nfunnel (unique visitors / wallets):")
  let prev: number | null = null
  for (const [name, kind] of funnel) {
    const e = byName.get(name)
    const n = e ? (kind === "anons" ? e.anons.size : e.wallets.size) : 0
    const rate = prev && prev > 0 ? `${((n / prev) * 100).toFixed(1)}%` : "—"
    console.log(`  ${name.padEnd(16)} ${String(n).padStart(5)}   step ${rate}`)
    prev = n
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED", e instanceof Error ? e.message : e)
    process.exit(1)
  })
