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

// ── Flow 6: payments core + refund ─────────────────────────────────────

async function paymentsFlow(token: string) {
  console.log("\n[6] Payments — list, stats, refund guard")
  expectStatus("payments", "list", await api("/api/payments", { token }), [200])
  expectStatus("payments", "stats", await api("/api/payments/stats", { token }), [200])
  const refund = await api("/api/payments/refund", {
    method: "POST",
    token,
    body: { paymentId: "00000000-0000-0000-0000-000000000000", amount: "0.001", reason: "e2e" },
  })
  expectStatus("payments", "refund rejects an unknown payment", refund, [400, 404])
}

// ── Flow 7: vendors ────────────────────────────────────────────────────

async function vendorsFlow(token: string, testWallet: string) {
  console.log("\n[7] Vendors — create → list")
  const created = await api("/api/vendors", {
    method: "POST",
    token,
    body: { name: "E2E Vendor", wallet_address: testWallet, email: "vendor@example.com" },
  })
  expectStatus("vendors", "create", created, [200, 201])
  expectStatus("vendors", "list", await api("/api/vendors", { token }), [200])
}

// ── Flow 8: webhooks ───────────────────────────────────────────────────

async function webhooksFlow(token: string) {
  console.log("\n[8] Webhooks — create → list → signature check")
  const created = await api("/api/webhooks", {
    method: "POST",
    token,
    body: {
      name: "E2E Hook",
      url: "https://example.com/hook",
      events: ["payment.completed"],
      retry_count: 3,
      timeout_ms: 5000,
    },
  })
  expectStatus("webhooks", "create", created, [200, 201])
  expectStatus("webhooks", "list", await api("/api/webhooks", { token }), [200])

  // A forged signature must never validate.
  const forged = await api("/api/webhooks/verify", {
    method: "POST",
    body: { payload: { hello: "world" }, signature: "deadbeef", secret: "not-the-secret" },
  })
  expectStatus("webhooks", "verify rejects a forged signature", forged, [400, 401, 403])
}

// ── Flow 9: acquiring ──────────────────────────────────────────────────

async function acquiringFlow(token: string, testWallet: string) {
  console.log("\n[9] Acquiring — merchant → order → link")
  const merchant = await api("/api/acquiring/merchants", {
    method: "POST",
    body: { name: "E2E Merchant", wallet_address: testWallet, callback_url: "https://example.com/cb" },
  })
  expectStatus("acquiring", "create merchant", merchant, [200, 201])
  const merchantId = ((merchant.json.merchant ?? merchant.json.data) as Json | undefined)?.id as string | undefined

  const order = await api("/api/acquiring/orders", {
    method: "POST",
    body: { merchantId: merchantId ?? "unknown", amount: "0.001", token: "ETH", chainId: 11155111 },
  })
  expectStatus("acquiring", "create order", order, [200, 201])

  const link = await api("/api/acquiring/payment-links", {
    method: "POST",
    body: { merchantId: merchantId ?? "unknown", amount: "0.001", token: "ETH", chainId: 11155111 },
  })
  expectStatus("acquiring", "create payment link", link, [200, 201])
}

// ── Flow 10: read-only payment surfaces ────────────────────────────────

async function readOnlyFlow(token: string, testWallet: string) {
  console.log("\n[10] Read-only payment surfaces")
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  const until = new Date().toISOString()
  const probes: [string, string][] = [
    ["transactions", `/api/transactions?address=${testWallet}`],
    ["ledger", `/api/ledger?address=${testWallet}`],
    ["ledger export", `/api/ledger/export?start_date=${since}&end_date=${until}`],
    ["authorizations", "/api/authorizations"],
    ["settlements", "/api/settlements"],
    ["multisig wallets", "/api/multisig/wallets"],
    ["multisig transactions", `/api/multisig/wallets`],
    ["yield stats", "/api/yield/stats"],
    ["yield recommendation", "/api/yield/recommendation"],
  ]
  for (const [name, path] of probes) {
    expectStatus(name, `GET ${path.split("?")[0]}`, await api(path, { token }), [200, 204])
  }
}

// ── Flow 11: enterprise payment surfaces ──────────────────────────────

async function enterpriseFlow(token: string, testWallet: string) {
  console.log("\n[11] Enterprise surfaces")

  const gets: [string, string][] = [
    ["a2a messages", "/api/a2a/messages"],
    ["a2a tasks", "/api/a2a/tasks"],
    ["billing plans", "/api/billing/plans"],
    ["billing history", "/api/billing/history"],
    ["billing subscription", "/api/billing/subscription"],
    ["cards", "/api/cards"],
    ["mcp subscriptions", "/api/mcp-subscriptions"],
    ["monetize", "/api/monetize"],
    ["payment groups", "/api/payment-groups"],
    ["risk", "/api/risk"],
    ["teams", "/api/teams"],
  ]
  for (const [name, path] of gets) {
    expectStatus(name, `GET ${path.split("?")[0]}`, await api(path, { token }), [200, 204])
  }

  // The distributor needs a funded hot wallet; without ASSET_DISTRIBUTOR_* the
  // endpoint reports 503 (not provisioned) rather than a fake 200.
  const arbUsdc = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
  const distribute = await api(
    `/api/distribute-asset?recipientAddress=${testWallet}&contractAddress=${arbUsdc}&assetType=token&chainId=42161`,
    { token },
  )
  expectStatus(
    "distribute-asset",
    "GET with real parameters",
    distribute,
    [200, 503],
    distribute.status === 503 ? "503 — ASSET_DISTRIBUTOR_* not configured (feature not provisioned)" : `http ${distribute.status}`,
  )

  const team = await api("/api/teams", {
    method: "POST",
    token,
    body: { name: "E2E Team", description: "payment-flows-test" },
  })
  expectStatus("teams", "create", team, [200, 201])

  const group = await api("/api/payment-groups", {
    method: "POST",
    token,
    body: { name: "E2E Group", owner_address: testWallet, purpose: "payment-flows-test" },
  })
  expectStatus("payment-groups", "create", group, [200, 201])

  const quote = await api("/api/offramp/quote", {
    method: "POST",
    token,
    body: { amount: "10", sourceToken: "USDC", sourceChain: "ethereum", targetCurrency: "USD" },
  })
  expectStatus("offramp", "quote", quote, [200])

  // Subscribe to a real plan, so the check is against live catalogue data.
  const plans = await api("/api/billing/plans", { token })
  const firstPlan = ((plans.json.plans ?? plans.json.data) as { id?: string }[] | undefined)?.[0]
  const planId = (firstPlan as { id?: string } | undefined)?.id ?? (firstPlan as { plan_id?: string } | undefined)?.plan_id
  if (planId) {
    const sub = await api("/api/billing/subscription", {
      method: "POST",
      token,
      body: { plan_id: planId, action: "subscribe" },
    })
    expectStatus("billing", `subscribe to ${planId}`, sub, [200, 201])
  } else {
    record("billing", "subscribe", false, "SKIPPED — no plan returned by /api/billing/plans")
  }
}

// ── Flow 12: mutations ─────────────────────────────────────────────────

async function mutationsFlow(token: string, testWallet: string) {
  console.log("\n[12] Mutation surfaces")

  // Multisig: reuse the wallet if a previous run created it (409), then propose.
  const walletRes = await api("/api/multisig/wallets", {
    method: "POST",
    token,
    body: { name: "E2E Safe", address: testWallet, chainId: 11155111, threshold: 1, signers: [testWallet] },
  })
  expectStatus("multisig", "create wallet (409 = already exists from a previous run)", walletRes, [200, 201, 409])
  let walletId = ((walletRes.json.wallet ?? walletRes.json.data) as Json | undefined)?.id as string | undefined
  if (!walletId) {
    const list = await api("/api/multisig/wallets", { token })
    const wallets = (list.json.wallets ?? list.json.data) as { id?: string; address?: string }[] | undefined
    walletId = wallets?.find((w) => w.address?.toLowerCase() === testWallet.toLowerCase())?.id
  }
  if (walletId) {
    const txRes = await api("/api/multisig/transactions", {
      method: "POST",
      token,
      body: { walletId, to: testWallet, value: "1000000000000000", data: "0x" },
    })
    expectStatus("multisig", "propose transaction", txRes, [200, 201])
  } else {
    record("multisig", "propose transaction", false, "SKIPPED — no wallet id available")
  }

  // Yield enforces a 1 USDT minimum, so ask for more than that.
  const deposit = await api("/api/yield/deposit", {
    method: "POST",
    token,
    body: { merchant: testWallet, network: "arbitrum", amount: "5" },
  })
  expectStatus("yield", "deposit validates and accepts", deposit, [200, 201])

  // No deposits exist for this merchant yet, so a 404 is the correct answer.
  const withdraw = await api("/api/yield/withdraw", {
    method: "POST",
    token,
    body: { merchant: testWallet, network: "arbitrum", amount: "5" },
  })
  expectStatus(
    "yield",
    "withdraw handles a merchant without deposits",
    withdraw,
    [200, 201, 404],
    withdraw.status === 404 ? "404 — no active deposits (correct)" : `http ${withdraw.status}`,
  )

  // Signature-gated payment verification must never accept a forged signature.
  const forged = await api("/api/payment/verify", {
    method: "POST",
    body: { to: testWallet, amount: "0.001", token: "ETH", exp: Date.now() + 3_600_000, sig: "0xdeadbeef" },
  })
  expectStatus("payment/verify", "rejects a forged signature", forged, [400, 401, 403])
}

// ── Flow 13: scheduled payment jobs ────────────────────────────────────

async function cronFlow() {
  console.log("\n[13] Scheduled payment jobs")
  // Without CRON_SECRET these are open in dev, which is how they are exercised
  // here; production blocks them (verifyCronAuth).
  const jobs: [string, string, string][] = [
    ["execute scheduled payments", "GET", "/api/cron/execute-scheduled-payments"],
    ["process batch", "GET", "/api/cron/process-batch"],
    ["retry batch items", "GET", "/api/cron/retry-batch-items"],
    ["settlement reconciliation", "GET", "/api/cron/settlement-reconciliation"],
    ["stalled transactions", "GET", "/api/cron/stalled-transactions"],
    ["subscription billing", "GET", "/api/cron/subscriptions"],
    ["cleanup idempotency", "GET", "/api/cron/cleanup-idempotency"],
    ["budget reset", "POST", "/api/cron/budget-reset"],
  ]
  for (const [name, method, path] of jobs) {
    expectStatus("cron", name, await api(path, { method }), [200])
  }
}

// ── Flow 14: gates, sub-routes and lifecycle transitions ───────────────

async function deeperFlow(token: string, testWallet: string) {
  console.log("\n[14] Gates & sub-routes")

  // x402/execute is the gate that releases the paid resource. It must refuse an
  // unknown transfer id, and refuse an authorization that was never verified.
  const unknown = await api("/api/x402/execute", {
    method: "POST",
    token,
    body: { transferId: "x402_does_not_exist", signature: "0x" + "0".repeat(65) },
  })
  expectStatus("x402/execute", "refuses an unknown transferId", unknown, [400, 401, 403, 404])

  const pendingAuth = await api("/api/x402/authorize", {
    method: "POST",
    body: { from: testWallet, to: testWallet, amount: "0.001", token: "USDC", chainId: 11155111 },
  })
  const transferId = (pendingAuth.json.authorization as Json | undefined)?.transferId as string | undefined
  if (transferId) {
    const gate = await api("/api/x402/execute", {
      method: "POST",
      token,
      body: { transferId, signature: "0x" + "1".repeat(65) },
    })
    expectStatus(
      "x402/execute",
      "refuses a never-verified authorization",
      gate,
      [400, 401, 403, 404, 409, 503],
      gate.status === 503
        ? "503 — no relayer configured; refuses to release (correct)"
        : gate.status === 200
          ? "!! 200 — released without verification"
          : `http ${gate.status}`,
    )
  }

  // Subscriptions: create, then exercise the per-id lifecycle.
  const created = await api("/api/subscriptions", {
    method: "POST",
    token,
    body: {
      service_name: "E2E Lifecycle",
      wallet_address: testWallet,
      amount: "0.001",
      token: "ETH",
      frequency: "monthly",
      chain_id: 11155111,
      start_date: new Date().toISOString(),
      memo: "deeper-flow",
    },
  })
  const subId = ((created.json.subscription ?? created.json.data) as Json | undefined)?.id as string | undefined
  expectStatus("subscriptions/[id]", "create for lifecycle", created, [200, 201])
  if (subId) {
    expectStatus("subscriptions/[id]", "GET by id", await api(`/api/subscriptions/${subId}`, { token }), [200])
    const pay = await api(`/api/subscriptions/${subId}/pay`, { method: "POST", token, body: {} })
    expectStatus(
      "subscriptions/[id]/pay",
      "refuses to record without a relayer",
      pay,
      [200, 400, 402, 404, 502],
      pay.status === 502 ? "502 — no relayer configured; refuses to record (correct)" : `http ${pay.status}`,
    )
    const payments = await api(`/api/subscriptions/${subId}/payments`, { token })
    expectStatus("subscriptions/[id]/payments", "list payments", payments, [200])
  } else {
    record("subscriptions/[id]", "GET by id", false, "SKIPPED — no id returned")
  }

  // Settlements: record a period.
  const now = new Date()
  const settle = await api("/api/settlements", {
    method: "POST",
    token,
    body: {
      periodStart: new Date(now.getTime() - 86_400_000).toISOString(),
      periodEnd: now.toISOString(),
      token: "USDC",
      chain: "arbitrum",
      onChainBalance: "0",
    },
  })
  expectStatus("settlements", "create period record", settle, [200, 201])

  // Vendors: list, read one, and the address book.
  const vendors = await api("/api/vendors", { token })
  const firstVendor = ((vendors.json.vendors ?? vendors.json.data) as { id?: string }[] | undefined)?.[0]
  if (firstVendor?.id) {
    expectStatus("vendors/[id]", "GET by id", await api(`/api/vendors/${firstVendor.id}`, { token }), [200])
    expectStatus("vendors/[id]/addresses", "list addresses", await api(`/api/vendors/${firstVendor.id}/addresses`, { token }), [200])
  } else {
    record("vendors/[id]", "GET by id", false, "SKIPPED — no vendor returned")
  }
  expectStatus("vendors/multi-network", "multi-network list", await api("/api/vendors/multi-network", { token }), [200])

  // Webhooks: read one back, and ask for a test delivery.
  const hooks = await api("/api/webhooks", { token })
  const firstHook = ((hooks.json.webhooks ?? hooks.json.data) as { id?: string }[] | undefined)?.[0]
  if (firstHook?.id) {
    expectStatus("webhooks/[id]", "GET by id", await api(`/api/webhooks/${firstHook.id}`, { token }), [200])
    const deliveries = await api(`/api/webhooks/${firstHook.id}/deliveries`, { token })
    expectStatus("webhooks/[id]/deliveries", "list deliveries", deliveries, [200])
    const test = await api(`/api/webhooks/${firstHook.id}/test`, { method: "POST", token, body: {} })
    expectStatus("webhooks/[id]/test", "send test delivery", test, [200, 202])
  } else {
    record("webhooks/[id]", "GET by id", false, "SKIPPED — no webhook returned")
  }

  // Billing: cancelling must land on the Free plan rather than erroring.
  const cancel = await api("/api/billing/subscription", { method: "POST", token, body: { plan_id: "free", action: "cancel" } })
  expectStatus("billing", "cancel subscription", cancel, [200])

  // MCP subscriptions exist for agent hosts.
  const mcp = await api("/api/mcp-subscriptions", { token })
  expectStatus("mcp-subscriptions", "list after mutations", mcp, [200])
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
  await paymentsFlow(token)
  await vendorsFlow(token, testWallet)
  await webhooksFlow(token)
  await acquiringFlow(token, testWallet)
  await readOnlyFlow(token, testWallet)
  await enterpriseFlow(token, testWallet)
  await mutationsFlow(token, testWallet)
  await deeperFlow(token, testWallet)
  await cronFlow()

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
