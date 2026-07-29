/**
 * POST /api/subscriptions/[id]/onchain — Link a subscription to its on-chain
 * SubscriptionManager mandate.
 *
 * The payer creates the mandate themselves (one transaction, via
 * `createSubscriptionWithPermit`). This records the id the contract assigned so
 * the scheduler knows to charge through the contract rather than falling back to
 * pre-signed ERC-3009 authorizations.
 *
 * The submitted id is verified against the chain before it is stored: a caller
 * could otherwise point their subscription at someone else's mandate, or at one
 * whose terms differ from what the UI displayed.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, type Address, type Hex } from 'viem'
import { withAuth } from '@/lib/middleware/api-auth'
import { prisma } from '@/lib/prisma'
import { subscriptionService } from '@/lib/services/subscription-service'
import { getNetworkByChainId } from '@/lib/networks'
import {
  SUBSCRIPTION_MANAGER_ABI,
  getSubscriptionManagerAddress,
  isSubscriptionId,
} from '@/lib/services/subscription-manager-contract'

export const POST = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    const segments = request.nextUrl.pathname.split('/')
    const id = segments[segments.length - 2] || ''

    try {
      const body = await request.json()
      const onchainId: string = body?.subscriptionId
      const txHash: string | undefined = body?.txHash

      if (!isSubscriptionId(onchainId)) {
        return NextResponse.json(
          { error: 'subscriptionId must be a 32-byte hex string' },
          { status: 400 }
        )
      }

      const subscription = await subscriptionService.getById(id, ownerAddress)
      if (!subscription) {
        return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
      }

      const managerAddress = getSubscriptionManagerAddress(subscription.chain_id)
      if (!managerAddress) {
        return NextResponse.json(
          {
            error:
              `No SubscriptionManager is deployed on chain ${subscription.chain_id}. ` +
              'Use pre-signed authorizations instead.',
          },
          { status: 422 }
        )
      }

      const network = getNetworkByChainId(subscription.chain_id)
      if (!network?.rpcUrl) {
        return NextResponse.json(
          { error: `No RPC configured for chain ${subscription.chain_id}` },
          { status: 503 }
        )
      }

      // Read the mandate back from the chain. Storing an unverified id would let
      // a caller attach their subscription to a mandate they do not own.
      const client = createPublicClient({ transport: http(network.rpcUrl) })
      let onchain: any
      try {
        onchain = await client.readContract({
          address: managerAddress as Address,
          abi: SUBSCRIPTION_MANAGER_ABI,
          functionName: 'getSubscription',
          args: [onchainId as Hex],
        })
      } catch {
        return NextResponse.json(
          { error: 'No such subscription exists on the SubscriptionManager contract' },
          { status: 404 }
        )
      }

      const mismatch: string[] = []
      if (onchain.payer?.toLowerCase() !== ownerAddress.toLowerCase()) {
        mismatch.push('payer')
      }
      if (onchain.merchant?.toLowerCase() !== subscription.recipient_address.toLowerCase()) {
        mismatch.push('merchant')
      }
      if (onchain.cancelled) {
        mismatch.push('already cancelled')
      }

      if (mismatch.length > 0) {
        return NextResponse.json(
          {
            error:
              `The on-chain mandate does not match this subscription (${mismatch.join(', ')}). ` +
              'Nothing was linked.',
          },
          { status: 409 }
        )
      }

      await prisma.subscription.update({
        where: { id },
        data: {
          onchain_subscription_id: onchainId,
          manager_address: managerAddress,
          ...(txHash ? { last_tx_hash: txHash } : {}),
        },
      })

      return NextResponse.json({
        linked: true,
        subscriptionId: id,
        onchainSubscriptionId: onchainId,
        managerAddress,
        amountPerPeriod: onchain.amountPerPeriod?.toString(),
        remainingAuthorised: onchain.remainingAuthorised?.toString(),
        noticeSeconds: Number(onchain.noticeSeconds ?? 0),
      })
    } catch (error: any) {
      console.error('[Subscriptions] Failed to link on-chain mandate:', error)
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'That on-chain subscription is already linked to another record' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to link mandate' },
        { status: 500 }
      )
    }
  },
  { component: 'subscription-onchain' }
)
