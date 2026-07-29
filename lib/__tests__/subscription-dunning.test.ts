/**
 * Dunning schedule tests.
 *
 * The properties that matter: a permanently broken subscription must stop being
 * retried, a transient failure must be retried on a widening schedule, and the
 * retries must terminate.
 */

import {
  classifyFailure,
  planNextAttempt,
  dunningMessage,
  DEFAULT_RETRY_SCHEDULE_DAYS,
} from '../services/subscription-dunning'

const NOW = new Date('2026-07-28T00:00:00.000Z')

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

describe('classifyFailure', () => {
  it.each([
    ['No valid pre-signed authorization available for subscription abc', 'authorization'],
    ['USDC on chain 999 does not support ERC-3009', 'unsupported token'],
    ['execution reverted: SubscriptionExpired', 'expired'],
    ['execution reverted: SubscriptionInactive', 'cancelled on-chain'],
    ['Subscription sub_1 has a malformed on-chain id: 0xzz', 'bad link'],
  ])('treats %s as terminal (%s)', (message) => {
    expect(classifyFailure(new Error(message)).kind).toBe('hard')
  })

  it.each([
    'ERC20: transfer amount exceeds balance',
    'Relayer execution failed',
    'network timeout',
    'nonce too low',
  ])('treats %s as retryable', (message) => {
    expect(classifyFailure(new Error(message)).kind).toBe('soft')
  })

  it('treats an unrecognised failure as retryable', () => {
    // Abandoning a subscription that would have recovered costs the merchant
    // real revenue, so the ambiguous case errs toward retrying.
    expect(classifyFailure(new Error('something we have never seen')).kind).toBe('soft')
  })

  it('handles non-Error values without throwing', () => {
    expect(classifyFailure(undefined).kind).toBe('soft')
    expect(classifyFailure('plain string').kind).toBe('soft')
  })
})

describe('planNextAttempt', () => {
  const soft = new Error('ERC20: transfer amount exceeds balance')
  const hard = new Error('No valid pre-signed authorization available for subscription x')

  it('does not retry a failure that cannot succeed on retry', () => {
    const decision = planNextAttempt(0, hard, NOW)
    expect(decision.outcome).toBe('give_up')
    expect(decision.nextAttemptAt).toBeUndefined()
    expect(decision.kind).toBe('hard')
  })

  it('retries a transient failure on a widening schedule', () => {
    const first = planNextAttempt(0, soft, NOW)
    const second = planNextAttempt(1, soft, NOW)
    const third = planNextAttempt(2, soft, NOW)

    expect(first.outcome).toBe('retry')
    expect(daysBetween(NOW, first.nextAttemptAt!)).toBe(3)
    expect(daysBetween(NOW, second.nextAttemptAt!)).toBe(5)
    expect(daysBetween(NOW, third.nextAttemptAt!)).toBe(7)

    // Each wait is at least as long as the one before it.
    const waits = [first, second, third].map((d) => daysBetween(NOW, d.nextAttemptAt!))
    expect(waits).toEqual([...waits].sort((a, b) => a - b))
  })

  it('gives up once the schedule is exhausted', () => {
    const decision = planNextAttempt(DEFAULT_RETRY_SCHEDULE_DAYS.length, soft, NOW)
    expect(decision.outcome).toBe('give_up')
    expect(decision.nextAttemptAt).toBeUndefined()
  })

  it('terminates — retrying never continues past the schedule length', () => {
    // The previous implementation rescheduled every failure 24h out with no
    // counter, so a permanently unfunded wallet was retried forever.
    let attempts = 0
    let failed = 0
    while (attempts < 50) {
      const decision = planNextAttempt(failed, soft, NOW)
      attempts++
      if (decision.outcome === 'give_up') break
      failed++
    }
    expect(attempts).toBe(DEFAULT_RETRY_SCHEDULE_DAYS.length + 1)
  })

  it('flags the last scheduled retry so the payer can be warned', () => {
    expect(planNextAttempt(0, soft, NOW).isFinalAttempt).toBe(false)
    expect(planNextAttempt(1, soft, NOW).isFinalAttempt).toBe(false)
    expect(planNextAttempt(2, soft, NOW).isFinalAttempt).toBe(true)
  })

  it('counts attempts from one', () => {
    expect(planNextAttempt(0, soft, NOW).attempt).toBe(1)
    expect(planNextAttempt(2, soft, NOW).attempt).toBe(3)
  })

  it('honours a custom schedule', () => {
    const decision = planNextAttempt(0, soft, NOW, [1])
    expect(daysBetween(NOW, decision.nextAttemptAt!)).toBe(1)
    expect(decision.isFinalAttempt).toBe(true)
    expect(planNextAttempt(1, soft, NOW, [1]).outcome).toBe('give_up')
  })
})

describe('dunningMessage', () => {
  const soft = new Error('ERC20: transfer amount exceeds balance')
  const hard = new Error('No valid pre-signed authorization available for subscription x')

  it('tells the payer when the next attempt happens', () => {
    const message = dunningMessage(planNextAttempt(0, soft, NOW), 'Netflix')
    expect(message).toContain('Netflix')
    expect(message).toContain('2026-07-31')
  })

  it('warns when the next attempt is the last', () => {
    expect(dunningMessage(planNextAttempt(2, soft, NOW), 'Netflix')).toContain('final attempt')
  })

  it('tells the payer what to do when payments stop', () => {
    const message = dunningMessage(planNextAttempt(0, hard, NOW), 'Netflix')
    expect(message).toMatch(/re-authorize/i)
  })
})
