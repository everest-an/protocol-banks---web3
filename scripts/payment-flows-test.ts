/**
 * Payment-surface end-to-end checks, driven against a local dev server.
 *
 * Each flow prints PASS / FAIL / SKIP with the reason, so the output doubles as
 * the coverage report. Flows that need a real chain transaction use Sepolia
 * testnet tokens (the owner's funding wallet holds a little testnet ETH).
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/payment-flows-test.ts
 */

import { Wallet, JsonRpcProvider, parseEther, formatEther } from "ethers"
import { buildSiweMessage } from "@/lib/auth/siwe"

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const HOST = new URL(BASE).host
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"

type Json = Record<string, unknown>
const results: { flow: string; step: string; ok: boolean; note: string }[] = []

function record(flow: string, step: string, ok: boolean, note = "") {
  results.push({ flow, step, ok, note })
  console.log(`   ${ok ? "✅" : "❌"} ${step}${note ? ` — ${note}` : ""}`)
}

/**
 * Strict on purpose: only the listed status codes count as a pass. An earlier
 * version treated anything below 500 as success, which quietly marked 400s
 * (wrong request shape) as green — a report that can hide a broken flow is
 * worse than no report.
 */
function expectStatus(
  flow: string,
  step: string,
  res: { status: number; json: Json },
  ok: number[],
  note = "",
) {
  const serverError = String(res.json.error ?? res.json.message ?? "")
  const pass = ok.includes(res.status)
  record(
    flow,
    step,
    pass,
    pass ? note || `http ${res.status}` : `http ${res.status}${serverError ? `: ${serverError.slice(0, 90)}` : ""}`,
  )
}

async function api(
  path: string,
  init: { method?: string; body?: Json; token?: string } = {},
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const json = (await res.json().catch(() => ({}))) as Json
  return { status: res.status, json }
}

/** SIWE login with the test wallet; returns a JWT. */
async function login(): Promise<string> {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk) throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing")
  const wallet = new Wallet(pk)
  const nonceRes = await fetch(`${BASE}/api/auth/siwe/nonce`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  const message = buildSiweMessage({
    domain: HOST,
    address: wallet.address,
    uri: BASE,
    nonce,
    chainId: 11155111,
  })
  const signature = await wallet.signMessage(message)
  const verify = await api("/api/auth/siwe/verify", { method: "POST", body: { message, signature } })
  if (verify.status !== 200 || !verify.json.token) {
    throw new Error(`SIWE failed (${verify.status}): ${JSON.stringify(verify.json)}`)
  }
  return String(verify.json.token)
}

/** A real Sepolia transfer, so the flow sees an actual on-chain payment. */
async function payOnSepolia(to: string, amountEth: string): Promise<{ hash: string; from: string }> {
  const pk = process.env.FUNDING_WALLET_PRIVATE_KEY
  if (!pk) throw new Error("FUNDING_WALLET_PRIVATE_KEY missing (Sepolia test tokens live there)")
  const provider = new JsonRpcProvider(SEPOLIA_RPC, undefined, { staticNetwork: true })
  const payer = new Wallet(pk, provider)
  const balance = await provider.getBalance(payer.address)
  if (balance < parseEther(amountEth)) {
    throw new Error(`payer has ${formatEther(balance)} Sepolia ETH, needs ${amountEth}`)
  }
  const tx = await payer.sendTransaction({ to, value: parseEther(amountEth) })
  const receipt = await tx.wait()
  return { hash: tx.hash, from: `mined in block ${receipt?.blockNumber}` }
}

// ── Flow 1: invoice ────────────────────────────────────────────────────

async function invoiceFlow(token: string, testWallet: string) {
  console.log("\n[1] Invoice — create → read → real Sepolia payment → mark paid")
  const created = await api("/api/invoice", {
    method: "POST",
    token,
    body: {
      recipientAddress: testWallet,
      amount: "0.001",
      token: "ETH",
      chain: "Sepolia",
      description: "payment-flows-test",
      merchantName: "Protocol Bank E2E",
      expiresIn: 3600_000,
      metadata: { customerName: "E2E Bot", customerEmail: "e2e@example.com" },
    },
  })
  const invoice = created.json.invoice as Json | undefined
  const invoiceId = invoice?.invoice_id as string | undefined
  const sig = invoice?.signature as string | undefined
  record("invoice", "create", created.status === 200 && !!invoiceId, `http ${created.status}, id ${invoiceId ?? "?"}`)
  record("invoice", "payment link returned", !!created.json.paymentLink, String(created.json.paymentLink ?? "missing"))
  if (!invoiceId || !sig) return

  // Viewing requires the link's signature — that is the access control.
  const read = await api(`/api/invoice?id=${invoiceId}&sig=${sig}`)
  const readInv = (read.json.invoice ?? read.json) as Json
  record("invoice", "read back is pending", read.status === 200 && readInv.status === "pending", `status=${readInv.status ?? "?"}`)
  record("invoice", "read without signature is refused", (await api(`/api/invoice?id=${invoiceId}`)).status === 403, "403 expected")

  let txHash = ""
  try {
    const pay = await payOnSepolia(testWallet, "0.001")
    txHash = pay.hash
    record("invoice", "Sepolia test-token payment sent", true, txHash)
  } catch (e) {
    record("invoice", "Sepolia test-token payment sent", false, e instanceof Error ? e.message : String(e))
    return
  }

  const patched = await api("/api/invoice", {
    method: "PATCH",
    token,
    body: { invoiceId, status: "paid", txHash, paidBy: testWallet },
  })
  record("invoice", "mark paid with txHash", patched.status === 200, `http ${patched.status}`)

  const after = await api(`/api/invoice?id=${invoiceId}&sig=${sig}`)
  const afterInv = (after.json.invoice ?? after.json) as Json
  record("invoice", "status is paid", afterInv.status === "paid", `status=${afterInv.status ?? "?"}`)
  record("invoice", "tx hash stored", afterInv.tx_hash === txHash, `tx=${String(afterInv.tx_hash ?? "?").slice(0, 12)}…`)
  record("invoice", "payer recorded", afterInv.customer_wallet === testWallet, `customer_wallet=${String(afterInv.customer_wallet ?? "?").slice(0, 12)}…`)
}

// ── Flow 2: x402 (machine payments over HTTP 402) ──────────────────────

async function x402Flow(token: string, testWallet: string) {
  console.log("\n[2] x402 — authorize → verify → settle")
  const challenge = await api("/api/x402")
  expectStatus("x402", "resource challenge answered", challenge, [200, 402], `http ${challenge.status}`)

  // authorize is public: it returns the EIP-3009 payload to sign plus a transfer id.
  const authBody = {
    from: testWallet,
    to: testWallet,
    amount: "0.001",
    token: "USDC",
    chainId: 11155111, // Sepolia
  }
  const authorize = await api("/api/x402/authorize", { method: "POST", body: authBody })
  expectStatus("x402", "authorize issues an authorization", authorize, [200])
  const authorization = authorize.json.authorization as Json | undefined
  const transferId = authorization?.transferId as string | undefined
  record("x402", "authorization carries a transferId", !!transferId, String(transferId ?? "missing"))
  record(
    "x402",
    "authorization asks the client to sign",
    !!(authorization?.messageToSign as Json | undefined),
    "messageToSign present (server holds no key)",
  )
  if (!transferId) return

  // verify refuses without both halves of the pair (transferId AND the settled txHash)
  const verifyMissingTx = await api("/api/x402/verify", { method: "POST", token, body: { transferId } })
  expectStatus("x402", "verify rejects a missing txHash", verifyMissingTx, [400])

  // Full settlement needs testnet USDC (an EIP-3009 transferWithAuthorization on
  // Sepolia); this wallet only holds testnet ETH, so the happy path cannot be
  // completed here. Recorded rather than silently marked green.
  const usdc = await api("/api/x402/verify", {
    method: "POST",
    token,
    body: { transferId, txHash: "0x" + "0".repeat(64) },
  })
  expectStatus("x402", "verify rejects an unknown txHash", usdc, [400, 404])

  const settle = await api("/api/x402/settle", {
    method: "POST",
    token,
    body: {
      authorizationId: transferId,
      transactionHash: "0x" + "0".repeat(64),
      chainId: 11155111,
      amount: "0.001",
      token: "USDC",
      from: testWallet,
      to: testWallet,
    },
  })
  expectStatus("x402", "settle rejects an unknown authorization", settle, [400, 404])
  record(
    "x402",
    "full settlement (needs Sepolia USDC)",
    false,
    "SKIPPED — requires an EIP-3009 USDC transfer on Sepolia; wallet holds testnet ETH only",
  )
}

// ── Flow 3: subscriptions ──────────────────────────────────────────────

async function subscriptionFlow(token: string, testWallet: string) {
  console.log("\n[3] Subscriptions — create → list")
  const created = await api("/api/subscriptions", {
    method: "POST",
    token,
    body: {
      service_name: "E2E Test Service",
      wallet_address: testWallet,
      amount: "0.001",
      token: "ETH", // must be one of USDC, USDT, DAI, ETH, WETH, WBTC
      frequency: "monthly",
      chain_id: 11155111,
      start_date: new Date().toISOString(),
      memo: "payment-flows-test",
    },
  })
  expectStatus("subscriptions", "create", created, [200, 201])

  const list = await api("/api/subscriptions", { token })
  expectStatus("subscriptions", "list", list, [200])
}

// ── Flow 4: batch payment ──────────────────────────────────────────────

async function batchFlow(token: string, testWallet: string) {
  console.log("\n[4] Batch payment — create → stats")
  const created = await api("/api/batch-payment", {
    method: "POST",
    token,
    body: {
      recipients: [
        { address: testWallet, amount: "0.0005" },
        { address: testWallet, amount: "0.0005" },
      ],
      token: "ETH",
      chainId: 11155111,
      chain: "Sepolia",
    },
  })
  expectStatus("batch-payment", "create", created, [200, 201])
  const stats = await api("/api/batch-payment/stats", { token })
  expectStatus("batch-payment", "stats", stats, [200])
}

// ── Flow 5: split payment ──────────────────────────────────────────────

async function splitFlow(token: string, testWallet: string) {
  console.log("\n[5] Split payment — calculate → templates")
  const calc = await api("/api/split-payment/calculate", {
    method: "POST",
    token,
    body: { total_amount: "0.001", recipients: [{ address: testWallet, percentage: 100 }] },
  })
  expectStatus("split-payment", "calculate", calc, [200])
  const templates = await api("/api/split-payment/templates", { token })
  expectStatus("split-payment", "templates", templates, [200])
}

async function main() {
  const testWallet = new Wallet(process.env.AGENT_TEST_WALLET_PRIVATE_KEY as string).address
  console.log(`app    : ${BASE}`)
  console.log(`wallet : ${testWallet}`)

  const token = await login()
  console.log("auth   : SIWE ok")

  await invoiceFlow(token, testWallet)
  await x402Flow(token, testWallet)
  await subscriptionFlow(token, testWallet)
  await batchFlow(token, testWallet)
  await splitFlow(token, testWallet)

  const pass = results.filter((r) => r.ok).length
  const fail = results.filter((r) => !r.ok)
  console.log(`\n──────── summary: ${pass}/${results.length} steps ok ────────`)
  if (fail.length) {
    console.log("failures:")
    for (const f of fail) console.log(`   ${f.flow} · ${f.step} — ${f.note}`)
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
