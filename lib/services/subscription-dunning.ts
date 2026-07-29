/**
 * Dunning: what to do when a subscription charge fails.
 *
 * Follows the convention established by card and direct-debit processors: a
 * failed charge is retried a small number of times on a widening schedule, the
 * payer is told each time, and after the last attempt the subscription stops
 * trying rather than retrying forever.
 *
 * Two things this deliberately does NOT do:
 *
 *   - Retry a failure that cannot succeed on a retry. A revoked authorization or
 *     an expired mandate will fail identically every time; retrying it burns
 *     relayer gas and delays telling the payer that their subscription is dead.
 *   - Retry indefinitely. The previous behaviour re-scheduled every failure 24h
 *     out with no attempt counter, so a permanently broken subscription would
 *     be retried forever.
 */

export type FailureKind = 'soft' | 'hard'

export type DunningOutcome = 'retry' | 'give_up'

export interface DunningDecision {
  outcome: DunningOutcome
  /** 1-based number of the attempt that just failed. */
  attempt: number
  /** When to try again. Absent when giving up. */
  nextAttemptAt?: Date
  /** True when this was the last attempt that will be made. */
  isFinalAttempt: boolean
  kind: FailureKind
  reason: string
}

/**
 * Days to wait after each failed attempt. Widening rather than fixed, because
 * the most common soft failure is an unfunded wallet and the payer needs time
 * to notice and top up.
 *
 * Three retries over ~15 days matches typical processor dunning windows.
 */
export const DEFAULT_RETRY_SCHEDULE_DAYS = [3, 5, 7] as const

/**
 * Failures that will produce the same result on every retry.
 *
 * Matched against the error text the executor produces. Anything unrecognised is
 * treated as soft: retrying a transient failure costs a little gas, while
 * abandoning a subscription that would have recovered costs the merchant real
 * revenue, so the ambiguous case should err toward retrying.
 */
const HARD_FAILURE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /no valid pre-signed authorization|requires? re-authorization/i,
    reason: 'The payer has no remaining authorization for this period.',
  },
  {
    pattern: /does not support ERC-3009|not registered with a SubscriptionManager/i,
    reason: 'This token cannot be charged without the payer present.',
  },
  {
    pattern: /SubscriptionInactive|cancelled/i,
    reason: 'The subscription was cancelled on-chain.',
  },
  {
    pattern: /SubscriptionExpired/i,
    reason: 'The authorization has reached its end date or period limit.',
  },
  {
    pattern: /malformed on-chain id/i,
    reason: 'The subscription is not correctly linked to its on-chain record.',
  },
  {
    pattern: /risk|blocked by risk/i,
    reason: 'The charge was blocked by risk screening.',
  },
]

/**
 * Classify a failure as retryable or terminal.
 */
export function classifyFailure(error: unknown): { kind: FailureKind; reason: string } {
  const message = error instanceof Error ? error.message : String(error ?? '')

  for (const { pattern, reason } of HARD_FAILURE_PATTERNS) {
    if (pattern.test(message)) {
      return { kind: 'hard', reason }
    }
  }

  return {
    kind: 'soft',
    reason: message || 'The charge did not go through.',
  }
}

/**
 * Decide what happens after a charge fails.
 *
 * @param failedAttempts How many attempts had already failed before this one.
 * @param error The failure from the executor.
 * @param now Current time (injected so the schedule is testable).
 */
export function planNextAttempt(
  failedAttempts: number,
  error: unknown,
  now: Date = new Date(),
  schedule: readonly number[] = DEFAULT_RETRY_SCHEDULE_DAYS
): DunningDecision {
  const { kind, reason } = classifyFailure(error)
  const attempt = failedAttempts + 1

  // A terminal failure is not retried — the payer has to act before a charge
  // could ever succeed.
  if (kind === 'hard') {
    return { outcome: 'give_up', attempt, isFinalAttempt: true, kind, reason }
  }

  // `failedAttempts` indexes the wait that follows this failure.
  const waitDays = schedule[failedAttempts]

  if (waitDays === undefined) {
    return { outcome: 'give_up', attempt, isFinalAttempt: true, kind, reason }
  }

  const nextAttemptAt = new Date(now.getTime() + waitDays * 24 * 60 * 60 * 1000)

  return {
    outcome: 'retry',
    attempt,
    nextAttemptAt,
    // The retry being scheduled is the last one the schedule allows.
    isFinalAttempt: failedAttempts + 1 >= schedule.length,
    kind,
    reason,
  }
}

/**
 * Message shown to the payer for a failed charge.
 *
 * Says what happens next, because "payment failed" alone leaves the payer unsure
 * whether they need to do anything.
 */
export function dunningMessage(decision: DunningDecision, serviceName: string): string {
  if (decision.outcome === 'give_up') {
    return decision.kind === 'hard'
      ? `${serviceName}: ${decision.reason} Payments have stopped — re-authorize to resume.`
      : `${serviceName}: payment failed after ${decision.attempt} attempts. ` +
        `Payments have stopped — check your balance and re-authorize to resume.`
  }

  const when = decision.nextAttemptAt?.toISOString().slice(0, 10)
  const tail = decision.isFinalAttempt ? ' This is the final attempt.' : ''
  return `${serviceName}: payment failed (attempt ${decision.attempt}). We'll try again on ${when}.${tail}`
}
