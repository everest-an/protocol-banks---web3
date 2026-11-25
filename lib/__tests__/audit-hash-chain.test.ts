import { canonicalize, hashAuditEvent, verifyAuditChain, type StoredAuditEvent } from "@/lib/audit/hash-chain"

function buildChain(count: number): StoredAuditEvent[] {
  const events: StoredAuditEvent[] = []
  let prevHash = "genesis"
  for (let seq = 1; seq <= count; seq++) {
    const at = `2026-11-25T12:00:0${seq}.000Z`
    const details = { seq, at, prevHash, amountUsd: seq * 10 }
    const hash = hashAuditEvent({
      actor: "0xabc",
      action: "agent.payment.confirmed",
      targetType: "agent_payment",
      targetId: `pay_${seq}`,
      seq,
      at,
      prevHash,
      details,
    })
    events.push({
      action: "agent.payment.confirmed",
      actor: "0xabc",
      targetType: "agent_payment",
      targetId: `pay_${seq}`,
      seq,
      at,
      prevHash,
      details,
      hash,
    })
    prevHash = hash
  }
  return events
}

describe("audit hash chain", () => {
  it("canonicalizes object keys deterministically", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
  })

  it("verifies an untampered chain", () => {
    const events = buildChain(3)
    expect(verifyAuditChain(events)).toEqual({ valid: true })
  })

  it("detects a tampered payload", () => {
    const events = buildChain(3)
    events[1].details.amountUsd = 999
    const result = verifyAuditChain(events)
    expect(result.valid).toBe(false)
    expect(result.firstInvalid).toBe(2)
  })

  it("detects a broken prevHash link", () => {
    const events = buildChain(3)
    events[2].prevHash = "deadbeef"
    const result = verifyAuditChain(events)
    expect(result.valid).toBe(false)
    expect(result.firstInvalid).toBe(3)
  })

  it("detects a missing event", () => {
    const events = buildChain(3)
    events.splice(1, 1)
    const result = verifyAuditChain(events)
    expect(result.valid).toBe(false)
    expect(result.firstInvalid).toBe(3)
  })
})
