/**
 * Agent Module
 *
 * Place orders for an account through the platform's risk envelope, and read
 * the state the platform enforces. Auth is `Authorization: Bearer pb_...`.
 */
import type { ProtocolBanksConfig } from "./types"

export interface AgentOrderRequest {
  coin: string
  side: "long" | "short"
  /** Notional in USD. Clamped to the platform's position cap. */
  sizeUsd: number
  reason?: string
}

export interface AgentOrderResponse {
  ok: boolean
  fill?: { coin: string; side: "long" | "short"; avgPx: number; size: number; notional: number }
  fee?: number
  mode?: "live" | "paper"
  error?: string
}

export class Agent {
  private readonly config: ProtocolBanksConfig

  constructor(config: ProtocolBanksConfig) {
    this.config = config
  }

  private baseUrl(): string {
    return this.config.baseUrl || "https://protocolbanks.com"
  }

  async order(request: AgentOrderRequest): Promise<AgentOrderResponse> {
    const res = await fetch(`${this.baseUrl()}/api/v1/agent/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(request),
    })
    return (await res.json()) as AgentOrderResponse
  }

  async state(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl()}/api/v1/agent/state`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    })
    return (await res.json()) as Record<string, unknown>
  }
}
