/**
 * Enforce-mode smoke: drives the API with the server running under
 * RLS_MODE=enforce and checks the flows that previously broke there.
 *
 *   # terminal 1
 *   $env:RLS_MODE='enforce'; pnpm dev
 *   # terminal 2
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/rls-enforce-smoke.ts
 *
 * Covers: SIWE login, invoice create → mark paid (paidBy) → read (customer
 * wallet recorded), and the stats/risk endpoints that hit P2028 before the
 * scoped-transaction maxWait/retry fix.
 */
import { Wallet } from "ethers"
import { buildSiweMessage } from "@/lib/auth/siwe"

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const HOST = new URL(BASE).host
let pass = 0
let fail = 0

const check = (n: string, ok: boolean, note = "") => {
  if (ok) pass++
  else fail++
  console.log(`${ok ? "✅" : "❌"} ${n}${note ? ` — ${note}` : ""}`)
}

async function api(path: string, init: { method?: string; body?: unknown; token?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

async function login(): Promise<string> {
  const wallet = new Wallet(process.env.AGENT_TEST_WALLET_PRIVATE_KEY as string)
  const nonceRes = await fetch(`${BASE}/api/auth/siwe/nonce`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  const message = buildSiweMessage({ domain: HOST, address: wallet.address, uri: BASE, nonce, chainId: 11155111 })
  const signature = await wallet.signMessage(message)
  const v = await api("/api/auth/siwe/verify", { method: "POST", body: { message, signature } })
  return String(v.json.token ?? "")
}

async function main() {
  const wallet = new Wallet(process.env.AGENT_TEST_WALLET_PRIVATE_KEY as string)
  const token = await login()
  check("login (SIWE)", !!token)

  const created = await api("/api/invoice", {
    method: "POST",
    token,
    body: { recipientAddress: wallet.address, amount: 1, token: "USDC", chain: "Ethereum", description: "rls smoke" },
  })
  const inv1 = (created.json.invoice ?? created.json) as Record<string, unknown>
  const invoiceId = String(inv1.invoice_id ?? "")
  const sig = String(inv1.signature ?? "")
  check("invoice create", (created.status === 200 || created.status === 201) && !!invoiceId, `http ${created.status}`)

  const txHash = "0x" + "ab".repeat(32)
  const patched = await api("/api/invoice", {
    method: "PATCH",
    token,
    body: { invoiceId, status: "paid", txHash, paidBy: wallet.address },
  })
  check("invoice patch (paidBy)", patched.status === 200, `http ${patched.status}`)

  const read = await api(`/api/invoice?id=${encodeURIComponent(invoiceId)}&sig=${encodeURIComponent(sig)}`)
  const inv2 = (read.json.invoice ?? read.json) as Record<string, unknown>
  check("invoice status=paid", inv2.status === "paid", `status=${String(inv2.status)}`)
  check(
    "customer_wallet recorded",
    String(inv2.customer_wallet ?? "").toLowerCase() === wallet.address.toLowerCase(),
    `cw=${String(inv2.customer_wallet ?? "?")}`,
  )

  for (const p of ["/api/payments/stats", "/api/batch-payment/stats", `/api/risk?view=screen&address=${wallet.address}`]) {
    const r = await api(p, { token })
    check(`GET ${p.split("?")[0]}`, r.status === 200, `http ${r.status}`)
  }

  console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.log("FATAL " + String((e as Error)?.message ?? e).slice(0, 200))
  process.exit(1)
})
