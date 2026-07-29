/**
 * GET /api/multisig/wallets/[id] — Get wallet details
 * DELETE /api/multisig/wallets/[id] — Delete wallet (if no pending transactions)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/api-auth'

export const GET = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    try {
      const id = request.nextUrl.pathname.split('/').pop() || ''
      if (!id) {
        return NextResponse.json({ error: 'Missing wallet ID' }, { status: 400 })
      }
      const wallet = await prisma.multisigWallet.findUnique({
        where: { id },
        include: {
          transactions: true,
        },
      })

      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
      }

      if (wallet.owner_address !== ownerAddress) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      return NextResponse.json({ wallet })
    } catch (error) {
      console.error('[Multisig] Failed to fetch wallet:', error)
      return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
    }
  },
  { component: 'multisig-wallet' }
)

export const DELETE = withAuth(
  async (request: NextRequest, ownerAddress: string) => {
    try {
      const id = request.nextUrl.pathname.split('/').pop() || ''
      if (!id) {
        return NextResponse.json({ error: 'Missing wallet ID' }, { status: 400 })
      }
      const wallet = await prisma.multisigWallet.findUnique({
        where: { id },
        include: { transactions: true },
      })

      if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
      }

      if (wallet.owner_address !== ownerAddress) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const pendingTxs = wallet.transactions.filter((tx) => tx.status === 'pending')
      if (pendingTxs.length > 0) {
        return NextResponse.json(
          { error: 'Cannot delete wallet with pending transactions' },
          { status: 409 }
        )
      }

      await prisma.multisigWallet.delete({ where: { id } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('[Multisig] Failed to delete wallet:', error)
      return NextResponse.json({ error: 'Failed to delete wallet' }, { status: 500 })
    }
  },
  { component: 'multisig-wallet' }
)
