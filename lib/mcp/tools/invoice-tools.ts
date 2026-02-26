/**
 * MCP Invoice Tools
 *
 * Authenticated tools for creating and listing invoices.
 * Invoices generate payment links for receiving funds.
 *
 * @module lib/mcp/tools/invoice-tools
 */

import { prisma } from '@/lib/prisma'
import type { McpAuthContext } from '../auth'
import { requireAuth } from '../auth'

// ─── Tool Definitions ───────────────────────────────────────────────

export const createInvoiceTool = {
  name: 'create_invoice',
  description:
    'Create a new invoice for receiving payments. Generates a payment link that can be shared. Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      amount: {
        type: 'string',
        description: 'Invoice amount as a decimal string (e.g. "250.00").',
      },
      token: {
        type: 'string',
        description: 'Token to receive (e.g. "USDT", "USDC").',
      },
      network: {
        type: 'string',
        description: 'Network to receive on (e.g. "ethereum", "base").',
      },
      description: {
        type: 'string',
        description: 'Invoice description or memo.',
      },
      due_date: {
        type: 'string',
        description: 'Optional due date in ISO 8601 format.',
      },
    },
    required: ['amount', 'token'],
  },
}

export const listInvoicesTool = {
  name: 'list_invoices',
  description:
    'List invoices for the authenticated wallet. Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      status: {
        type: 'string',
        description: 'Filter by status: pending, paid, expired, cancelled.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20, max: 100).',
      },
    },
  },
}

// ─── Handlers ───────────────────────────────────────────────────────

export async function handleCreateInvoice(
  args: {
    amount: string
    token: string
    network?: string
    description?: string
    due_date?: string
  },
  authCtx: McpAuthContext
): Promise<unknown> {
  const address = requireAuth(authCtx)

  const amountNum = parseFloat(args.amount)
  if (isNaN(amountNum) || amountNum <= 0) {
    throw new Error('Amount must be a positive number.')
  }

  const expiresAt = args.due_date
    ? new Date(args.due_date)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days default

  const invoiceId = `INV-${Date.now().toString(36).toUpperCase()}`

  const invoice = await prisma.invoice.create({
    data: {
      invoice_id: invoiceId,
      recipient_address: address,
      amount: amountNum,
      token: args.token.toUpperCase(),
      chain: args.network ?? 'Ethereum',
      description: args.description,
      expires_at: expiresAt,
      status: 'pending',
    },
  })

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.protocolbanks.com'
  const paymentLink = `${baseUrl}/pay?invoice=${invoice.invoice_id}`

  return {
    invoice_id: invoice.invoice_id,
    id: invoice.id,
    status: 'pending',
    amount: amountNum,
    token: args.token.toUpperCase(),
    network: args.network ?? 'ethereum',
    description: args.description,
    payment_link: paymentLink,
    created_at: invoice.created_at.toISOString(),
    expires_at: expiresAt.toISOString(),
  }
}

export async function handleListInvoices(
  args: { status?: string; limit?: number },
  authCtx: McpAuthContext
): Promise<unknown> {
  const address = requireAuth(authCtx)
  const limit = Math.min(args.limit ?? 20, 100)

  const where: Record<string, unknown> = { recipient_address: address }
  if (args.status) where.status = args.status

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
    select: {
      id: true,
      invoice_id: true,
      status: true,
      amount: true,
      token: true,
      chain: true,
      description: true,
      expires_at: true,
      paid_at: true,
      created_at: true,
    },
  })

  return {
    invoices: invoices.map((inv) => ({
      invoice_id: inv.invoice_id,
      id: inv.id,
      status: inv.status,
      amount: inv.amount,
      token: inv.token,
      chain: inv.chain,
      description: inv.description,
      expires_at: inv.expires_at.toISOString(),
      paid_at: inv.paid_at?.toISOString(),
      created_at: inv.created_at.toISOString(),
    })),
    total: invoices.length,
  }
}
