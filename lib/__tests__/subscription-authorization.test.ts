/**
 * Tests for the client-side subscription pre-authorization flow.
 *
 * The property that matters: every billing period gets its own signature bound
 * to its own nonce and window. If periods ever shared a nonce, the second charge
 * would revert on-chain; if a window didn't cover its due date, the charge would
 * be rejected as expired.
 */

import {
  signAndStoreAuthorizations,
  authorizeSubscriptionPeriods,
  type AuthorizationPlan,
} from '../subscription-authorization'

jest.mock('@/lib/auth/siwe-client', () => ({
  getAccessToken: jest.fn().mockReturnValue('test-token'),
  refreshSiweToken: jest.fn().mockResolvedValue('test-token'),
}))

const OWNER = '0x1234567890123456789012345678901234567890'
const RECIPIENT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'

function makePlan(periods: number): AuthorizationPlan {
  const base = Math.floor(Date.now() / 1000)
  return {
    subscriptionId: 'sub-1',
    from: OWNER,
    to: RECIPIENT,
    amount: '10',
    token: 'USDC',
    tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    chainId: 42161,
    authorizations: Array.from({ length: periods }, (_, i) => ({
      periodIndex: i,
      dueDate: new Date((base + i * 2592000) * 1000).toISOString(),
      nonce: '0x' + String(i).padStart(64, '0'),
      validAfter: base + i * 2592000 - 3600,
      validBefore: base + i * 2592000 + 259200,
    })),
  }
}

describe('subscription pre-authorization', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ stored: 12, submitted: 12 }),
    }) as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('signs each period with that period\'s own nonce and window', async () => {
    const plan = makePlan(3)
    const seen: Array<{ nonce?: string; validAfter?: number; validBefore?: number }> = []

    const signAuthorization = jest.fn(async (params: any) => {
      seen.push({
        nonce: params.nonce,
        validAfter: params.validAfter,
        validBefore: params.validBefore,
      })
      return { signature: '0x' + 'ab'.repeat(65) }
    })

    await signAndStoreAuthorizations({
      plan,
      ownerAddress: OWNER,
      signAuthorization,
    })

    expect(signAuthorization).toHaveBeenCalledTimes(3)
    // Each period must carry the tuple the server will later submit.
    plan.authorizations.forEach((entry, i) => {
      expect(seen[i].nonce).toBe(entry.nonce)
      expect(seen[i].validAfter).toBe(entry.validAfter)
      expect(seen[i].validBefore).toBe(entry.validBefore)
    })

    // Reusing a nonce would make every charge after the first revert.
    const nonces = seen.map((s) => s.nonce)
    expect(new Set(nonces).size).toBe(nonces.length)
  })

  it('posts every signed period back to the server', async () => {
    const plan = makePlan(4)
    await signAndStoreAuthorizations({
      plan,
      ownerAddress: OWNER,
      signAuthorization: async () => ({ signature: '0x' + 'cd'.repeat(65) }),
    })

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/subscriptions/sub-1/authorize')
    expect(init.method).toBe('POST')

    const body = JSON.parse(init.body)
    expect(body.authorizations).toHaveLength(4)
    expect(body.authorizations.map((a: any) => a.periodIndex)).toEqual([0, 1, 2, 3])
    body.authorizations.forEach((a: any) => {
      expect(a.signature).toMatch(/^0x[a-f0-9]+$/)
    })
  })

  it('reports progress as each period is signed', async () => {
    const progress: Array<[number, number]> = []
    await signAndStoreAuthorizations({
      plan: makePlan(3),
      ownerAddress: OWNER,
      signAuthorization: async () => ({ signature: '0x' + 'ef'.repeat(65) }),
      onProgress: (signed, total) => progress.push([signed, total]),
    })

    expect(progress).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
  })

  it('stores nothing when the user rejects a signature partway through', async () => {
    const signAuthorization = jest
      .fn()
      .mockResolvedValueOnce({ signature: '0x' + 'ab'.repeat(65) })
      .mockRejectedValueOnce(new Error('User rejected the request'))

    await expect(
      signAndStoreAuthorizations({
        plan: makePlan(3),
        ownerAddress: OWNER,
        signAuthorization,
      })
    ).rejects.toThrow('User rejected')

    // A partially stored plan would leave later periods silently unpayable.
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('surfaces a server rejection of an invalid signature', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Signature for period 2 does not verify against ' + OWNER }),
    }) as any

    await expect(
      signAndStoreAuthorizations({
        plan: makePlan(3),
        ownerAddress: OWNER,
        signAuthorization: async () => ({ signature: '0xdeadbeef' }),
      })
    ).rejects.toThrow('does not verify')
  })

  it('does not prompt for a signature when there is nothing to authorize', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...makePlan(0) }),
    }) as any

    const signAuthorization = jest.fn()
    const result = await authorizeSubscriptionPeriods({
      subscriptionId: 'sub-1',
      ownerAddress: OWNER,
      periods: 12,
      signAuthorization,
    })

    expect(result).toEqual({ stored: 0, total: 0 })
    expect(signAuthorization).not.toHaveBeenCalled()
  })
})
