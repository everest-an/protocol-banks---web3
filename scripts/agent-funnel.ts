/**
 * The agent-API acquisition funnel: views → keys → first order → invoices,
 * plus the npm weekly downloads for the two published packages.
 *
 *   DAYS=30 npx tsx -r dotenv/config scripts/agent-funnel.ts
 *   pnpm funnel:agents
 *
 * npm has no user count — only downloads. A brand-new package answers 404
 * until the downloads index catches up, which this prints as "not indexed yet".
 */
import { prisma } from "../lib/prisma"

const DAYS = Number(process.env.DAYS || 30)
const PACKAGES = ["@everestan/protocolbanks-sdk", "@everestan/protocolbanks-agent-tools"]

const FUNNEL: Array<{ name: string; unique: "anon" | "wallet" }> = [
  { name: "agents_view", unique: "anon" },
  { name: "api_key_created", unique: "wallet" },
  { name: "policy_updated", unique: "wallet" },
  { name: "agent_op", unique: "wallet" },
  { name: "agent_invoice_created", unique: "wallet" },
]

async function npmDownloads(pkg: string): Promise<string> {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`)
    if (!res.ok) return "not indexed yet"
    const json = (await res.json()) as { downloads?: number }
    return typeof json.downloads === "number" ? String(json.downloads) : "n/a"
  } catch {
    return "unreachable"
  }
}

async function main() {
  const since = new Date(Date.now() - DAYS * 86_400_000)
  const rows = await prisma.usageEvent.findMany({
    where: { created_at: { gte: since } },
    select: { name: true, anon_id: true, wallet: true },
  })

  const byName = new Map<string, { events: number; anons: Set<string>; wallets: Set<string> }>()
  for (const row of rows) {
    const entry = byName.get(row.name) ?? { events: 0, anons: new Set<string>(), wallets: new Set<string>() }
    entry.events++
    if (row.anon_id) entry.anons.add(row.anon_id)
    if (row.wallet) entry.wallets.add(row.wallet)
    byName.set(row.name, entry)
  }

  console.log(`window: last ${DAYS} days — ${rows.length} events\n`)
  console.log("event".padEnd(24), "events".padStart(7), "unique".padStart(8))
  for (const step of FUNNEL) {
    const entry = byName.get(step.name)
    const unique = entry ? (step.unique === "anon" ? entry.anons.size : entry.wallets.size) : 0
    console.log(step.name.padEnd(24), String(entry?.events ?? 0).padStart(7), String(unique).padStart(8))
  }

  const keyCreators = byName.get("api_key_created")?.wallets ?? new Set<string>()
  const traders = byName.get("agent_op")?.wallets ?? new Set<string>()
  const activated = [...keyCreators].filter((wallet) => traders.has(wallet))
  const rate = keyCreators.size > 0 ? ((activated.length / keyCreators.size) * 100).toFixed(1) : "—"
  console.log(`\nactivation: ${activated.length} wallet(s) created a key and placed an order (${rate}% of key creators)`)

  const keys = await prisma.apiKey.findMany({ select: { policy: true, is_active: true } })
  const withPolicy = keys.filter((key) => key.policy !== null).length
  const active = keys.filter((key) => key.is_active).length
  console.log(`keys now: ${keys.length} (${withPolicy} with a policy, ${active} active)`)

  const downloads = await Promise.all(PACKAGES.map(npmDownloads))
  console.log(`npm downloads (last week): ${PACKAGES.map((pkg, i) => `${pkg.split("/")[1]} ${downloads[i]}`).join(" · ")}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("FAILED", error instanceof Error ? error.message : error)
    process.exit(1)
  })
