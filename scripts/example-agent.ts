/**
 * Walk the agent API with one credential: state → order → (optional) invoice.
 *
 *   PB_KEY=pb_… pnpm example:agent [--invoice]
 *
 * PB_BASE  platform origin, default https://protocolbanks.com
 * PB_USD   order notional, default 20
 * PB_TO    destination for the invoice, default a placeholder burn address
 *
 * The example never calls `pay` or `swap`: both return something the agent must
 * sign from its own wallet, so there is nothing this script could execute.
 * A refused order (403 policy / 409 guard) is printed, not thrown — the point
 * is to show the refusal, so the run still exits 0.
 */

const KEY = process.env.PB_KEY
const BASE = (process.env.PB_BASE || "https://protocolbanks.com").replace(/\/+$/, "")
const USD = Number(process.env.PB_USD || 20)
const TO = process.env.PB_TO || "0x000000000000000000000000000000000000dEaD"
const WITH_INVOICE = process.argv.includes("--invoice")

interface PolicyView {
  allowedOps: string[]
  maxNotionalUsd: number
  dailyCapUsd: number
  allowedCoins: string[]
  spentTodayUsd: number
}

interface StateView {
  ok?: boolean
  mode?: string
  account?: { totalEquity?: number }
  policy?: PolicyView
}

interface OrderView {
  ok?: boolean
  fill?: { coin: string; side: string; avgPx: number; size: number; notional: number }
  fee?: number
  mode?: string
  remainingTodayUsd?: number
}

interface InvoiceView {
  ok?: boolean
  invoice?: { invoiceId: string; status: string; expiresAt: string }
}

interface ErrorBody {
  error?: string
  message?: string
}

const usd = (value: number | undefined) => (typeof value === "number" ? `$${value.toFixed(2)}` : "?")

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; json: T & ErrorBody }> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = (await res.json().catch(() => ({}))) as T & ErrorBody
  return { status: res.status, json }
}

const refused = (status: number, json: ErrorBody) =>
  `REFUSED (${status}): ${json.error || json.message || "no message"}`

if (!KEY) {
  console.log("usage: PB_KEY=pb_… pnpm example:agent [--invoice]")
  console.log("  PB_KEY   the API key to walk (required)")
  console.log("  PB_BASE  platform origin, default https://protocolbanks.com")
  process.exit(1)
}

async function main(): Promise<number> {
  const state = await call<StateView>("GET", "/v1/agent/state")
  if (state.status !== 200) {
    console.log(refused(state.status, state.json))
    return 1
  }

  const policy = state.json.policy
  console.log(`mode: ${state.json.mode} · equity: ${usd(state.json.account?.totalEquity)}`)
  if (policy) {
    console.log(
      `policy: ${policy.allowedOps.join(", ") || "none"} · per-call ${usd(policy.maxNotionalUsd)} · daily ${usd(policy.dailyCapUsd)} · spent today ${usd(policy.spentTodayUsd)}`,
    )
  }

  const order = await call<OrderView>("POST", "/v1/agent/orders", { coin: "BTC", side: "long", sizeUsd: USD })
  if (order.status === 200 && order.json.fill) {
    const fill = order.json.fill
    console.log(`fill: ${fill.coin} ${fill.side} ${fill.size} @ ${usd(fill.avgPx)} · notional ${usd(fill.notional)}`)
    console.log(`fee: ${usd(order.json.fee)} · mode: ${order.json.mode} · remainingTodayUsd: ${usd(order.json.remainingTodayUsd)}`)
  } else if (order.status === 403 || order.status === 409) {
    console.log(refused(order.status, order.json))
  } else {
    console.log(refused(order.status, order.json))
    return 1
  }

  if (WITH_INVOICE) {
    const invoice = await call<InvoiceView>("POST", "/v1/agent/invoice", {
      to: TO,
      amount: USD,
      token: "USDC",
      description: "example:agent run",
      expiresInHours: 24,
    })
    if (invoice.status !== 200 || !invoice.json.invoice) {
      console.log(refused(invoice.status, invoice.json))
      return 1
    }
    const created = invoice.json.invoice
    console.log(`invoice: ${created.invoiceId} · ${created.status} · expires ${created.expiresAt}`)
  }

  console.log("not called: pay and swap return something you sign from your own wallet — this example cannot execute them")
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.log(`FAIL ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })

export {}
