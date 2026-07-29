/**
 * GET /api/multisig/transactions — List pending transactions for a wallet
 * POST /api/multisig/transactions — Create a new multisig transaction proposal
 */

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/api-auth'

export const GET = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const { searchParams } = new URL(request.url)
    const multisigId = searchParams.get('walletId')

    if (!multisigId) {
      return NextResponse.json(
        { error: 'Missing walletId parameter' },
        { status: 400 }
      )
    }

    const wallet = await prisma.multisigWallet.findUnique({
      where: { id: multisigId },
    })

    if (!wallet || wallet.owner_address !== ownerAddress) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const transactions = await prisma.multisigTransaction.findMany({
      where: {
        multisig_id: multisigId,
        status: 'pending',
      },
      include: {
        confirmations: true,
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('[Multisig] Failed to fetch transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}, { component: 'multisig-transactions' })

export const POST = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const body = await request.json()
    const { walletId, to, value, data } = body

    const wallet = await prisma.multisigWallet.findUnique({
      where: { id: walletId },
    })

    if (!wallet || wallet.owner_address !== ownerAddress) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const txCount = await prisma.multisigTransaction.count({
      where: { multisig_id: walletId },
    })

    const transaction = await prisma.multisigTransaction.create({
      data: {
        multisig_id: walletId,
        to_address: to,
        value: value || '0',
        data: data || null,
        nonce: txCount,
        status: 'pending',
        threshold: wallet.threshold,
        created_by: ownerAddress,
      },
      include: {
        confirmations: true,
      },
    })

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    console.error('[Multisig] Failed to create transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}, { component: 'multisig-transactions' })
