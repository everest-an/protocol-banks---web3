const BASE = (process.env.PB_BASE_URL || "https://www.protocolbanks.com").replace(/\/+$/, "")

export interface SandboxSession {
  sandbox: true
  source: string
  expiresAt: string
  serviceId: string
  quoteId: string
  buyer: { address: string; key: string }
  seller: { address: string; key: string }
}

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : `request failed (${response.status})`
    throw new Error(message)
  }
  return body as T
}

export async function createSandboxSession(source = "example"): Promise<SandboxSession> {
  const response = await fetch(`${BASE}/api/sandbox/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  })
  return parse<SandboxSession>(response)
}

export async function getState(key: string) {
  const response = await fetch(`${BASE}/api/v1/agent/state`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  return parse<Record<string, unknown>>(response)
}

export async function acceptQuote(key: string, quoteId: string) {
  const response = await fetch(`${BASE}/api/v1/agent/commerce/quotes/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ quoteId }),
  })
  return parse<{ order: { id: string; status: string } }>(response)
}

export async function deliverOrder(key: string, orderId: string, deliveryHash: string, deliveryUri?: string) {
  const response = await fetch(`${BASE}/api/v1/agent/commerce/orders/deliver`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, deliveryHash, deliveryUri }),
  })
  return parse<{ order: { id: string; status: string; deliveryHash: string } }>(response)
}

export async function listOrders(key: string) {
  const response = await fetch(`${BASE}/api/v1/agent/commerce/orders`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  return parse<{ orders: Array<{ id: string; status: string; amountUsd: number }> }>(response)
}
