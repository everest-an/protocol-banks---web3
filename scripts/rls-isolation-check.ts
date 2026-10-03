/**
 * RLS isolation check — proves the database enforces tenant isolation itself.
 *
 * Requires the policies from scripts/034_enable_rls_all_tables.sql to be applied.
 * Runs the scoped path in-process (RLS_MODE=enforce) and asserts that an owner
 * sees their rows, a stranger sees none, and un-scoped (system) access is
 * unaffected. Retries transient transaction-start timeouts.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/rls-isolation-check.ts
 */
process.env.RLS_MODE = "enforce"

import { prisma, scopedTransaction } from "@/lib/prisma"
import { runWithWallet } from "@/lib/rls/context"

const STRANGER = "0x0000000000000000000000000000000000000000"

let passed = 0
let failed = 0

function check(name: string, ok: boolean, note = "") {
  if (ok) passed++
  else failed++
  console.log(`   ${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`)
}

/** Prisma Postgres occasionally times out starting a transaction under bursts. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      last = error
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  throw last
}

async function main() {
  const owners = (await withRetry(() =>
    prisma.$queryRawUnsafe(
      `SELECT lower(owner_address) AS o FROM vendors WHERE owner_address IS NOT NULL GROUP BY owner_address ORDER BY count(*) DESC LIMIT 1`
    )
  )) as Array<{ o: string }>
  const owner = owners[0]?.o
  if (!owner) throw new Error("no vendor owner found — seed some vendors first")
  console.log(`owner = ${owner}`)

  const own = (fn: (tx: Parameters<Parameters<typeof scopedTransaction>[0]>[0]) => Promise<number>) =>
    withRetry(() => runWithWallet(owner, async () => await scopedTransaction(fn)))
  const stranger = (fn: (tx: Parameters<Parameters<typeof scopedTransaction>[0]>[0]) => Promise<number>) =>
    withRetry(() => runWithWallet(STRANGER, async () => await scopedTransaction(fn)))

  const systemVendors = await withRetry(() => prisma.vendor.count())
  const ownerVendors = await own((tx) => tx.vendor.count())
  const strangerVendors = await stranger((tx) => tx.vendor.count())
  check("system sees every vendor", systemVendors > 0, `count=${systemVendors}`)
  check("owner sees their vendors", ownerVendors > 0, `count=${ownerVendors}`)
  check("stranger sees no vendors", strangerVendors === 0, `count=${strangerVendors}`)

  // Child table (EXISTS policy via the parent's owner).
  const ownerItems = await own((tx) => tx.batchItem.count())
  const strangerItems = await stranger((tx) => tx.batchItem.count())
  check("owner sees their batch items", ownerItems > 0, `count=${ownerItems}`)
  check("stranger sees no batch items", strangerItems === 0, `count=${strangerItems}`)

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
