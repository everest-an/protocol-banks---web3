/**
 * Production smoke test — post-deploy verification against the live site.
 *
 * Exercises login (two wallets), core authenticated surfaces, the invoice
 * flow, and cross-wallet isolation: a fresh wallet must not see the test
 * wallet's data. Writes only under the test wallet, which RLS isolates.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/prod-smoke.ts
 * Override target: E2E_BASE_URL=https://...
 */
import { Wallet } from "ethers"
import { buildSiweMessage } from "@/lib/auth/siwe"

const BASE = process.env.E2E_BASE_URL ?? "https://www.protocolbanks.com"
const HOST = new URL(BASE).host

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, note = "") => {
  if (ok) passed++
  else failed++
  console.log(`${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`)
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

async function login(pk: string): Promise<string> {
  const wallet = new Wallet(pk)
  const nonceRes = await fetch(`${BASE}/api/auth/siwe/nonce`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  const message = buildSiweMessage({ domain: HOST, address: wallet.address, uri: BASE, nonce, chainId: 1 })
  const signature = await wallet.signMessage(message)
  const verify = await api("/api/auth/siwe/verify", { method: "POST", body: { message, signature } })
  if (verify.status !== 200 || !verify.json.token) {
    throw new Error(`SIWE failed for ${wallet.address} (${verify.status}): ${JSON.stringify(verify.json)}`)
  }
  return String(verify.json.token)
}

function listOf(json: Record<string, unknown>, key: string): unknown[] {
  const value = json[key]
  return Array.isArray(value) ? value : []
}

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk) throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing")
  const testWallet = new Wallet(pk)
  const stranger = Wallet.createRandom()

  // 1. Auth for both wallets
  const tokenA = await login(pk)
  check("login: test wallet", !!tokenA)
  const tokenB = await login(stranger.privateKey)
  check("login: fresh wallet", !!tokenB)

  // 2. Core authenticated surface: batch listing
  const batchesA = await api("/api/batch-payment?limit=5", { token: tokenA })
  const countA = listOf(batchesA.json, "batches").length
  check("test wallet: batch list", batchesA.status === 200, `http ${batchesA.status} batches=${countA}`)

  const batchesB = await api("/api/batch-payment?limit=5", { token: tokenB })
  const countB = listOf(batchesB.json, "batches").length
  check(
    "isolation: fresh wallet sees no batches",
    batchesB.status === 200 && countB === 0,
    `http ${batchesB.status} batches=${countB}`,
  )

  // 3. Invoice flow: create → mark paid → read back
  const created = await api("/api/invoice", {
    method: "POST",
    token: tokenA,
    body: { recipientAddress: testWallet.address, amount: 1, token: "USDC", chain: "Ethereum", description: "prod smoke" },
  })
  const invoice = (created.json.invoice ?? created.json) as Record<string, unknown>
  const invoiceId = String(invoice.invoice_id ?? "")
  const signature = String(invoice.signature ?? "")
  check("invoice create", (created.status === 200 || created.status === 201) && !!invoiceId, `http ${created.status}`)

  const patched = await api("/api/invoice", {
    method: "PATCH",
    token: tokenA,
    body: { invoiceId, status: "paid", txHash: "0x" + "cd".repeat(32), paidBy: testWallet.address },
  })
  check("invoice mark paid", patched.status === 200, `http ${patched.status}`)

  const read = await api(`/api/invoice?id=${encodeURIComponent(invoiceId)}&sig=${encodeURIComponent(signature)}`)
  const fetched = (read.json.invoice ?? read.json) as Record<string, unknown>
  check(
    "invoice read back: paid + payer recorded",
    fetched.status === "paid" && String(fetched.customer_wallet ?? "").toLowerCase() === testWallet.address.toLowerCase(),
    `status=${String(fetched.status)} payer=${String(fetched.customer_wallet ?? "?")}`,
  )

  // 4. Stats endpoints (scoped reads)
  for (const path of ["/api/payments/stats", "/api/batch-payment/stats"]) {
    const r = await api(path, { token: tokenA })
    check(`stats: ${path}`, r.status === 200, `http ${r.status}`)
  }

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
