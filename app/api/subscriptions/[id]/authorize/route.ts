/**
 * Pre-signed authorizations for a subscription.
 *
 * GET  /api/subscriptions/[id]/authorize?periods=N
 *   Returns N unsigned ERC-3009 authorizations — one per upcoming billing
 *   period, each with its own nonce and a validity window covering that period.
 *   The client signs each with the owner's wallet.
 *
 * POST /api/subscriptions/[id]/authorize
 *   Stores the signed authorizations. Every signature is verified against the
 *   exact tuple it claims to sign before it is written, so an invalid signature
 *   is rejected here rather than reverting on-chain weeks later.
 *
 * Why per-period: an ERC-3009 signature commits to
 * (from, to, value, validAfter, validBefore, nonce) and the nonce is single-use.
 * One signature cannot authorise a recurring charge, and the server holds no key
 * that could stand in for the user's.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { verifyTypedData, type Address, type Hex } from 'viem'
import { withAuth } from '@/lib/middleware/api-auth'
import { prisma } from '@/lib/prisma'
import { subscriptionService } from '@/lib/services/subscription-service'
import { calculateNextPaymentDate } from '@/lib/subscription-helpers'
import {
  buildTransferAuthorizationTypedData,
  createTransferAuthorization,
  getTokenAddress,
  isERC3009Supported,
  parseTokenAmount,
} from '@/lib/erc3009'

const MAX_PERIODS = 24
const DEFAULT_PERIODS = 12

/** Clock-skew tolerance so a charge due exactly on the boundary still lands. */
const WINDOW_LEAD_SECONDS = 60 * 60 // 1 hour before the due date
const WINDOW_TRAIL_SECONDS = 60 * 60 * 24 * 3 // 3 days after, to survive retries

function subscriptionIdFromPath(request: NextRequest): string {
  const segments = request.nextUrl.pathname.split('/')
  // .../subscriptions/[id]/authorize
  return segments[segments.length - 2] || ''
}

/**
 * Build the authorization tuple for each upcoming billing period.
 * Each window brackets that period's due date so only the intended period's
 * authorization is valid at charge time.
 */
function buildPeriodPlan(
  subscription: Awaited<ReturnType<typeof subscriptionService.getById>>,
  periods: number,
  startIndex: number
) {
  if (!subscription) throw new Error('Subscription required')

  const tokenAddress = getTokenAddress(subscription.chain_id, subscription.token)
  if (!tokenAddress) {
    throw new Error(
      `${subscription.token} does not support ERC-3009 on chain ${subscription.chain_id}`
    )
  }

  let dueDate = subscription.next_payment_date
    ? new Date(subscription.next_payment_date)
    : new Date()

  const plan = []
  for (let i = 0; i < periods; i++) {
    const dueSeconds = Math.floor(dueDate.getTime() / 1000)
    const auth = createTransferAuthorization({
      from: subscription.owner_address,
      to: subscription.recipient_address,
      amount: subscription.amount,
      chainId: subscription.chain_id,
      tokenSymbol: subscription.token,
    })

    const validAfter = dueSeconds - WINDOW_LEAD_SECONDS
    const validBefore = dueSeconds + WINDOW_TRAIL_SECONDS

    plan.push({
      periodIndex: startIndex + i,
      dueDate: dueDate.toISOString(),
      nonce: auth.nonce,
      validAfter,
      validBefore,
      typedData: buildTransferAuthorizationTypedData(
        subscription.chain_id,
        subscription.token,
        { ...auth, validAfter, validBefore }
      ),
    })

    dueDate = calculateNextPaymentDate(dueDate, subscription.frequency, {
      schedule_day: subscription.schedule_day,
      schedule_time: subscription.schedule_time,
    })
  }

  return { tokenAddress, plan }
}

export const GET = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    const id = subscriptionIdFromPath(request)
    const requested = Number(request.nextUrl.searchParams.get('periods')) || DEFAULT_PERIODS
    const periods = Math.min(Math.max(requested, 1), MAX_PERIODS)

    try {
      const subscription = await subscriptionService.getById(id, ownerAddress)
      if (!subscription) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
      }

      if (!isERC3009Supported(subscription.chain_id, subscription.token)) {
        return NextResponse.json(
          {
            error:
              `${subscription.token} on chain ${subscription.chain_id} does not support ERC-3009. ` +
              'Recurring charges require an ERC-3009-capable token (e.g. USDC).',
          },
          { status: 422 }
        )
      }

      // Continue numbering after whatever the user already signed.
      const last = await prisma.subscriptionAuthorization.findFirst({
        where: { subscription_id: id, period_index: { not: null } },
        orderBy: { period_index: 'desc' },
        select: { period_index: true },
      })
      const startIndex = (last?.period_index ?? -1) + 1

      const { tokenAddress, plan } = buildPeriodPlan(subscription, periods, startIndex)

      return NextResponse.json({
        subscriptionId: id,
        from: subscription.owner_address,
        to: subscription.recipient_address,
        amount: subscription.amount,
        token: subscription.token,
        tokenAddress,
        chainId: subscription.chain_id,
        authorizations: plan,
      })
    } catch (error) {
      console.error('[Subscriptions] Failed to build authorization plan:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to build authorizations' },
        { status: 500 }
      )
    }
  },
  { component: 'subscription-authorize' }
)

interface SignedAuthorizationInput {
  periodIndex: number
  nonce: string
  validAfter: number
  validBefore: number
  signature: string
}

export const POST = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    const id = subscriptionIdFromPath(request)

    try {
      const body = await request.json()
      const authorizations: SignedAuthorizationInput[] = body?.authorizations

      if (!Array.isArray(authorizations) || authorizations.length === 0) {
        return NextResponse.json({ error: 'No authorizations provided' }, { status: 400 })
      }
      if (authorizations.length > MAX_PERIODS) {
        return NextResponse.json(
          { error: `At most ${MAX_PERIODS} authorizations can be stored at once` },
          { status: 400 }
        )
      }

      const subscription = await subscriptionService.getById(id, ownerAddress)
      if (!subscription) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
      }

      const tokenAddress = getTokenAddress(subscription.chain_id, subscription.token)
      if (!tokenAddress) {
        return NextResponse.json(
          { error: `${subscription.token} does not support ERC-3009 on chain ${subscription.chain_id}` },
          { status: 422 }
        )
      }

      const from = subscription.owner_address.toLowerCase()
      const to = subscription.recipient_address.toLowerCase()
      const value = parseTokenAmount(subscription.amount)

      // Verify every signature before storing any of them. An authorization that
      // does not recover to the owner is worthless — it would revert on-chain
      // and leave the subscription silently unpayable.
      const verified = []
      for (const input of authorizations) {
        const typedData = buildTransferAuthorizationTypedData(
          subscription.chain_id,
          subscription.token,
          {
            from,
            to,
            value,
            validAfter: input.validAfter,
            validBefore: input.validBefore,
            nonce: input.nonce,
          }
        )

        const isValid = await verifyTypedData({
          address: from as Address,
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType,
          message: typedData.message as any,
          signature: input.signature as Hex,
        })

        if (!isValid) {
          return NextResponse.json(
            {
              error:
                `Signature for period ${input.periodIndex} does not verify against ${from}. ` +
                'Nothing was saved.',
            },
            { status: 400 }
          )
        }

        verified.push({
          subscription_id: id,
          user_address: from,
          recipient_address: to,
          amount: subscription.amount,
          token_address: tokenAddress.toLowerCase(),
          chain_id: subscription.chain_id,
          nonce: input.nonce,
          valid_after: new Date(input.validAfter * 1000),
          valid_before: new Date(input.validBefore * 1000),
          signature: input.signature,
          status: 'active',
          period_index: input.periodIndex,
        })
      }

      const result = await prisma.subscriptionAuthorization.createMany({
        data: verified,
        skipDuplicates: true, // re-submitting the same period is a no-op
      })

      return NextResponse.json({ stored: result.count, submitted: verified.length }, { status: 201 })
    } catch (error) {
      console.error('[Subscriptions] Failed to store authorizations:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to store authorizations' },
        { status: 500 }
      )
    }
  },
  { component: 'subscription-authorize' }
)
