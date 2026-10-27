/**
 * End-to-end QA for `scripts/example-agent.ts`.
 *
 * Provisions a paper account and a scoped API key, runs the example against a
 * live dev server, asserts what it printed and what landed in the database,
 * then deletes every row it created.
 *
 *   # terminal 1
 *   npx next dev --turbopack -p 3200
 *   # terminal 2
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/example-agent-qa.ts
 *
 * PB_QA_BASE overrides the dev server origin (default http://localhost:3200).
 * `--read-only` provisions a read-only key instead, to prove a policy refusal
 * is printed as REFUSED (403) and creates no position.
 */

import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { APIKeyService, type Permission } from "@/lib/services/api-key-service"
import { prisma } from "@/lib/prisma"

/**
 * Paper state lives in `.data/trading/state-<wallet>.json` and is cached in the
 * dev server per wallet, so a fixed wallet makes a second run see the previous
 * position ("already holding BTC"). Every run therefore gets its own wallet;
 * PB_QA_WALLET pins one when the server was started fresh.
 */
const WALLET = (process.env.PB_QA_WALLET || `0x${"0".repeat(34)}${randomBytes(3).toString("hex")}`).toLowerCase()
const BASE = (process.env.PB_QA_BASE || "http://localhost:3200").replace(/\/+$/, "")
const READ_ONLY = process.argv.includes("--read-only")
const MERCHANT = `agent:${WALLET.slice(0, 6)}…${WALLET.slice(-4)}`
const EXAMPLE = join(process.cwd(), "scripts", "example-agent.ts")
const STATE_FILE = join(process.cwd(), ".data", "trading", `state-${WALLET}.json`)

let checks = 0

function check(name: string, ok: boolean, note = ""): void {
  if (!ok) throw new Error(`${name}${note ? ` — ${note}` : ""}`)
  checks++
  console.log(`  PASS ${name}`)
}

async function reachable(): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(10_000) })
      if (res.status < 500) return true
    } catch (error) {
      console.error(`  (attempt ${attempt + 1}: ${error instanceof Error ? error.message : String(error)})`)
    }
  }
  return false
}

function runExample(env: Record<string, string>, args: string[] = []): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [EXAMPLE, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, PB_BASE: BASE, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error("example timed out after 60s"))
    }, 60_000)
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function cleanup(): Promise<void> {
  await prisma.usageEvent.deleteMany({ where: { wallet: WALLET } })
  await prisma.apiKey.deleteMany({ where: { owner_address: WALLET } })
  await prisma.invoice.deleteMany({ where: { merchant_name: MERCHANT } })
  await prisma.tradeRecord.deleteMany({ where: { wallet_address: WALLET } })
  await prisma.tradingAccount.deleteMany({ where: { wallet_address: WALLET } })
  rmSync(STATE_FILE, { force: true })
}

/** The paper ledger is exposed by `state`, not `trade_records` (the paper agent
 *  has no owner address, so the DB receipt hook is a no-op in paper mode). */
interface PositionView {
  symbol: string
  side: string
}

async function fetchPositions(secret: string): Promise<PositionView[]> {
  const res = await fetch(`${BASE}/api/v1/agent/state`, { headers: { Authorization: `Bearer ${secret}` } })
  const json = (await res.json().catch(() => ({}))) as { positions?: PositionView[] }
  return res.status === 200 && Array.isArray(json.positions) ? json.positions : []
}

/** The route writes the receipt and the ledger fire-and-forget; poll briefly. */
async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, attempts = 20): Promise<T> {
  let value = await read()
  for (let attempt = 0; attempt < attempts && !done(value); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500))
    value = await read()
  }
  return value
}

async function reportZeroRows(): Promise<void> {  const [trades, invoices, keys, events, accounts] = await Promise.all([
    prisma.tradeRecord.count({ where: { wallet_address: WALLET } }),
    prisma.invoice.count({ where: { merchant_name: MERCHANT } }),
    prisma.apiKey.count({ where: { owner_address: WALLET } }),
    prisma.usageEvent.count({ where: { wallet: WALLET } }),
    prisma.tradingAccount.count({ where: { wallet_address: WALLET } }),
  ])
  console.log(
    `db after cleanup: ${trades} trade_records · ${invoices} invoices · ${keys} api_keys · ${events} usage_events · ${accounts} trading_accounts for ${WALLET}`,
  )
  check("cleanup left no rows for the QA wallet", trades + invoices + keys + events + accounts === 0)
}

async function main(): Promise<void> {
  if (!(await reachable())) {
    console.log(`FAIL dev server not reachable at :${new URL(BASE).port || "80"} (${BASE})`)
    process.exit(1)
  }

  await cleanup()
  await prisma.tradingAccount.create({
    data: { wallet_address: WALLET, status: "paper", budget_usd: 500 },
  })

  const policy = READ_ONLY
    ? { allowedOps: ["read"], maxNotionalUsd: 100, dailyCapUsd: 200, allowedCoins: [] }
    : { allowedOps: ["read", "trade", "pay"], maxNotionalUsd: 100, dailyCapUsd: 200, allowedCoins: [] }

  const created = await new APIKeyService().create({
    name: `example-agent qa${READ_ONLY ? " (read only)" : ""}`,
    owner_address: WALLET,
    permissions: (READ_ONLY ? ["read"] : ["write", "read"]) as Permission[],
    policy,
  })

  const keyDir = mkdtempSync(join(tmpdir(), "pb-example-key-"))
  const keyFile = join(keyDir, "example-key.json")
  writeFileSync(keyFile, JSON.stringify({ key: created.secret, owner: WALLET }, null, 2), "utf8")
  console.log(`key: ${created.key.key_prefix}… written to ${keyFile}`)

  try {
    const state = await runExample({ PB_KEY: created.secret })
    check("state run exits 0", state.code === 0, state.stderr.trim() || state.stdout.trim())
    check("state run reports the account mode", state.stdout.includes("mode: paper"), state.stdout.trim())
    check("state run prints the policy", state.stdout.includes("policy: "), state.stdout.trim())
    check("state run explains pay/swap are not called", state.stdout.includes("not called: pay and swap"))

    if (READ_ONLY) {
      check("read-only order is refused with 403", state.stdout.includes("REFUSED (403)"), state.stdout.trim())
      const open = await prisma.tradeRecord.count({ where: { wallet_address: WALLET, status: "open" } })
      check("read-only run opened no position", open === 0, `open trade_records: ${open}`)
    } else {
      check("order run reports a fill", state.stdout.includes("fill:"), state.stdout.trim())
      check("order run reports the remaining daily budget", state.stdout.includes("remainingTodayUsd:"), state.stdout.trim())

      const positions = await fetchPositions(created.secret)
      check(
        "the paper account holds exactly one open BTC position",
        positions.length === 1 && positions[0].symbol === "BTC",
        `positions: ${JSON.stringify(positions)}`,
      )

      const receipts = await waitFor(
        () =>
          prisma.tradeRecord.findMany({
            where: { wallet_address: WALLET, status: "open", symbol: "BTC" },
            select: { mode: true },
          }),
        (rows) => rows.length > 0,
      )
      check(
        "the paper fill wrote a trade receipt",
        receipts.length === 1 && receipts[0].mode === "paper",
        `rows: ${JSON.stringify(receipts)}`,
      )

      const persisted = await waitFor(
        () => prisma.tradingAccount.findUnique({ where: { wallet_address: WALLET }, select: { state_json: true } }),
        (row) => Boolean((row?.state_json as { positions?: unknown[] } | null)?.positions?.length),
      )
      const ledger = (persisted?.state_json as { positions?: { symbol?: string }[] } | null)?.positions ?? []
      check(
        "the paper ledger is persisted in TradingAccount.state_json",
        ledger.some((position) => position.symbol === "BTC"),
        `positions in DB: ${JSON.stringify(ledger.map((position) => position.symbol))}`,
      )

      const refused = await runExample({ PB_KEY: created.secret, PB_USD: "5000" })
      check("over-cap order still exits 0", refused.code === 0, refused.stderr.trim() || refused.stdout.trim())
      check("over-cap order is refused with 403", refused.stdout.includes("REFUSED (403)"), refused.stdout.trim())
      check("the over-cap run reports no fill", !refused.stdout.includes("fill:"), refused.stdout.trim())

      const invoiced = await runExample({ PB_KEY: created.secret }, ["--invoice"])
      check("invoice run exits 0", invoiced.code === 0, invoiced.stderr.trim() || invoiced.stdout.trim())
      const match = invoiced.stdout.match(/invoice: (\S+) · pending · expires /)
      check("invoice run prints the invoice id, status and expiry", Boolean(match), invoiced.stdout.trim())
      const invoiceId = match ? match[1] : ""
      const invoice = invoiceId
        ? await prisma.invoice.findUnique({ where: { invoice_id: invoiceId }, select: { status: true, merchant_name: true } })
        : null
      check("the invoice row exists and is pending", invoice?.status === "pending", `found: ${invoice ? invoice.status : "none"}`)
      check("the invoice belongs to the QA wallet", invoice?.merchant_name === MERCHANT, `merchant: ${invoice?.merchant_name ?? "none"}`)

      const linkMatch = invoiced.stdout.match(/^pay: (\S+)$/m)
      check("invoice run prints a payment link", Boolean(linkMatch), invoiced.stdout.trim())
      const link = linkMatch ? linkMatch[1] : ""
      const params = link ? new URL(link).searchParams : null
      const id = params?.get("id") ?? params?.get("invoice") ?? ""
      const sig = params?.get("sig") ?? ""
      const readable = id
        ? await fetch(
            `${BASE}/api/invoice?id=${encodeURIComponent(id)}${sig ? `&sig=${encodeURIComponent(sig)}` : ""}`,
          ).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }))
        : { status: 0, body: {} }
      check(
        "the payment link resolves to the invoice",
        readable.status === 200 && (readable.body as { invoice?: { invoice_id?: string } }).invoice?.invoice_id === invoiceId,
        `status ${readable.status}`,
      )
    }
  } finally {
    rmSync(keyDir, { recursive: true, force: true })
    await cleanup()
  }

  await reportZeroRows()
  console.log(`PASS ${checks} checks`)
}

main()
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`)
    await cleanup().catch(() => {})
    process.exit(1)
  })
