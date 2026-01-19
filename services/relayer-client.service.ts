import { type AuthorizationMessage, type DomainInput } from "@/services/eip712.service"

const RELAYER_URL = process.env.RELAYER_URL || ""

export type RelayerSubmission = {
  domain: DomainInput
  message: AuthorizationMessage
  signature: string
}

export async function submitToRelayer(payload: RelayerSubmission) {
  if (!RELAYER_URL) {
    throw new Error("RELAYER_URL not configured")
  }
  const res = await fetch(`${RELAYER_URL}/submit-authorization`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Relayer submission failed: ${res.status}`)
  }
  return res.json()
}

export async function getRelayerStatus(txHash: string) {
  if (!RELAYER_URL) {
    throw new Error("RELAYER_URL not configured")
  }
  const res = await fetch(`${RELAYER_URL}/status/${txHash}`)
  if (!res.ok) {
    throw new Error(`Relayer status failed: ${res.status}`)
  }
  return res.json()
}
