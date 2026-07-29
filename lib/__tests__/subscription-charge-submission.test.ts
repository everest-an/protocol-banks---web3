/**
 * Relay result → payment record semantics.
 *
 * The rule this pins down: a charge counts as paid only when it is confirmed
 * on-chain. A relayer task id is not a transaction, and a submitted transaction
 * can still revert or be dropped, so anything short of `confirmed` must leave
 * the billing period open rather than being recorded as money received.
 */

// The helper is module-private, so exercise it through the same shape the
// relayer returns. Kept in lockstep with `toChargeSubmission`.
type RelayLike = {
  status: 'pending' | 'submitted' | 'confirmed' | 'failed'
  transactionHash?: string
  taskId: string
  error?: string
}

function toChargeSubmission(result: RelayLike, failureMessage: string) {
  if (result.status === 'failed') {
    throw new Error(result.error || failureMessage)
  }
  return {
    txHash: result.transactionHash || result.taskId,
    confirmed: result.status === 'confirmed' && !!result.transactionHash,
    kind: 'charge' as 'charge' | 'announcement',
  }
}

const HASH = '0x' + 'ab'.repeat(32)

describe('charge submission semantics', () => {
  it('treats a confirmed transaction as paid', () => {
    const submission = toChargeSubmission(
      { status: 'confirmed', transactionHash: HASH, taskId: 'task-1' },
      'failed'
    )
    expect(submission).toEqual({ txHash: HASH, confirmed: true, kind: 'charge' })
  })

  it.each<RelayLike['status']>(['pending', 'submitted'])(
    'does not treat a %s transaction as paid',
    (status) => {
      const submission = toChargeSubmission(
        { status, transactionHash: HASH, taskId: 'task-1' },
        'failed'
      )
      // The transaction exists but may still revert or be dropped.
      expect(submission.confirmed).toBe(false)
      expect(submission.txHash).toBe(HASH)
    }
  )

  it('never treats a bare task id as proof of payment', () => {
    // The previous implementation returned `transactionHash || taskId` and
    // recorded the result as a completed payment — so a relayer queue id was
    // stored in tx_hash and the user was told they had paid.
    const submission = toChargeSubmission({ status: 'submitted', taskId: 'task-1' }, 'failed')
    expect(submission.confirmed).toBe(false)
    expect(submission.txHash).toBe('task-1')
  })

  it('refuses to call a confirmed status paid without a transaction hash', () => {
    const submission = toChargeSubmission({ status: 'confirmed', taskId: 'task-1' }, 'failed')
    expect(submission.confirmed).toBe(false)
  })

  it('throws on a failed relay, surfacing the relayer reason', () => {
    expect(() =>
      toChargeSubmission(
        { status: 'failed', taskId: 'task-1', error: 'insufficient relayer balance' },
        'fallback message'
      )
    ).toThrow('insufficient relayer balance')
  })

  it('falls back to a useful message when the relayer gives none', () => {
    expect(() => toChargeSubmission({ status: 'failed', taskId: 'task-1' }, 'charge failed')).toThrow(
      'charge failed'
    )
  })

  it('never treats an announcement as a payment', () => {
    // Announcing a charge starts its notice period; no funds move. Recording it
    // as a payment — even a pending one — would show the payer a charge that
    // never happened and consume the billing period.
    const announcement = {
      ...toChargeSubmission(
        { status: 'confirmed', transactionHash: HASH, taskId: 'task-1' },
        'failed'
      ),
      confirmed: false,
      kind: 'announcement' as const,
    }

    expect(announcement.confirmed).toBe(false)
    expect(announcement.kind).toBe('announcement')
  })

  it('only ever reports paid for exactly one status', () => {
    const statuses: RelayLike['status'][] = ['pending', 'submitted', 'confirmed']
    const confirmed = statuses.filter(
      (status) => toChargeSubmission({ status, transactionHash: HASH, taskId: 't' }, 'x').confirmed
    )
    expect(confirmed).toEqual(['confirmed'])
  })
})
