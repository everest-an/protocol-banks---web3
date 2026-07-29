/**
 * GET /api/multisig/wallets — List multisig wallets for authenticated user
 * POST /api/multisig/wallets — Create a new multisig wallet
 */

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/api-auth'

export const GET = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const wallets = await prisma.multisigWallet.findMany({
      where: { owner_address: ownerAddress },
      include: {
        transactions: {
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
    })

    return NextResponse.json({ wallets })
  } catch (error) {
    console.error('[Multisig] Failed to fetch wallets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch wallets' },
      { status: 500 }
    )
  }
}, { component: 'multisig-wallets' })

export const POST = withAuth(async (request: NextRequest, ownerAddress: string) => {
  try {
    const body = await request.json()
    const { name, address, chainId, threshold, signers } = body

    if (!name || !address || !chainId || !threshold || !signers?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const wallet = await prisma.multisigWallet.create({
      data: {
        name,
        address,
        chain_id: chainId,
        threshold,
        signers,
        owner_address: ownerAddress,
      },
    })

    return NextResponse.json({ wallet }, { status: 201 })
  } catch (error: any) {
    console.error('[Multisig] Failed to create wallet:', error)
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Wallet address already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create wallet' },
      { status: 500 }
    )
  }
}, { component: 'multisig-wallets' })
