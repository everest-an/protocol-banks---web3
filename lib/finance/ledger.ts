import { createHash } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { categorizeTransaction } from "./categorize"
import { convertToUsd } from "./fx"

const SYNC_MONTHS = 12
const CONCURRENCY = 12

interface LedgerRow {
  source: string
  source_id: string
  dedupe_key: string
  kind: string
  direction: "in" | "out"
  category: string
  counterparty?: string | null
  description?: string | null
  amount_usd: number
  currency: string
  occurred_at: Date
  status: string
  metadata?: Prisma.InputJsonValue
}

function amount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0
}

function short(value: string | null | undefined): string {
  if (!value) return "unknown"
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32)
}

function startOfMonthsAgo(months: number): Date {
  const date = new Date()
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCMonth(date.getUTCMonth() - months)
  return date
}

async function upsertRows(wallet: string, rows: LedgerRow[]): Promise<void> {
  const unique = new Map<string, LedgerRow>()
  for (const row of rows) {
    if (!row.amount_usd || !Number.isFinite(row.amount_usd)) continue
    unique.set(row.dedupe_key, row)
  }
  const values = [...unique.values()]

  for (let index = 0; index < values.length; index += CONCURRENCY) {
    const chunk = values.slice(index, index + CONCURRENCY)
    await Promise.all(
      chunk.map((row) =>
        prisma.financeTransaction.upsert({
          where: {
            owner_address_dedupe_key: {
              owner_address: wallet,
              dedupe_key: row.dedupe_key,
            },
          },
          create: {
            owner_address: wallet,
            source: row.source,
            source_id: row.source_id,
            dedupe_key: row.dedupe_key,
            kind: row.kind,
            direction: row.direction,
            category: row.category,
            counterparty: row.counterparty ?? null,
            description: row.description ?? null,
            amount_usd: row.amount_usd,
            currency: row.currency,
            occurred_at: row.occurred_at,
            status: row.status,
            metadata: row.metadata,
          },
          update: {
            amount_usd: row.amount_usd,
            category: row.category,
            counterparty: row.counterparty ?? null,
            description: row.description ?? null,
            occurred_at: row.occurred_at,
            status: row.status,
            metadata: row.metadata,
          },
        }),
      ),
    )
  }
}

export async function syncFinanceLedger(walletAddress: string): Promise<void> {
  const wallet = walletAddress.toLowerCase()
  const start = startOfMonthsAgo(SYNC_MONTHS)

  const merchants = await prisma.merchant.findMany({
    where: {
      OR: [
        { wallet_address: { equals: wallet, mode: "insensitive" } },
        { user: { wallet_address: { equals: wallet, mode: "insensitive" } } },
      ],
    },
    select: { id: true },
  })
  const merchantIds = merchants.map((merchant) => merchant.id)

  const [payments, invoices, subscriptionPayments, agentPayments, acquiringOrders, trades] = await Promise.all([
    prisma.payment.findMany({
      where: {
        created_at: { gte: start },
        OR: [
          { from_address: { equals: wallet, mode: "insensitive" } },
          { to_address: { equals: wallet, mode: "insensitive" } },
        ],
      },
      take: 2000,
    }),
    prisma.invoice.findMany({
      where: { recipient_address: { equals: wallet, mode: "insensitive" }, created_at: { gte: start } },
      take: 1000,
    }),
    prisma.subscriptionPayment.findMany({
      where: { created_at: { gte: start }, subscription: { owner_address: { equals: wallet, mode: "insensitive" } } },
      include: { subscription: { select: { service_name: true, chain_id: true } } },
      take: 1000,
    }),
    prisma.agentPayment.findMany({
      where: { owner_address: { equals: wallet, mode: "insensitive" }, created_at: { gte: start } },
      take: 1000,
    }),
    merchantIds.length
      ? prisma.acquiringOrder.findMany({
          where: { merchant_id: { in: merchantIds }, created_at: { gte: start } },
          include: { merchant: { select: { name: true } } },
          take: 1000,
        })
      : Promise.resolve([]),
    prisma.tradeRecord.findMany({
      where: { wallet_address: wallet },
      orderBy: { opened_at: "desc" },
      take: 1000,
    }),
  ])

  const rows: LedgerRow[] = []

  for (const payment of payments) {
    const direction = payment.from_address.toLowerCase() === wallet ? "out" : "in"
    const value = amount(payment.amount_usd ?? payment.amount)
    if (!value) continue
    rows.push({
      source: "payment",
      source_id: payment.id,
      dedupe_key: payment.tx_hash ? `tx:${payment.chain}:${payment.tx_hash.toLowerCase()}` : `payment:${payment.id}`,
      kind: direction === "in" ? "income" : "expense",
      direction,
      category: payment.category || (direction === "in" ? "Income" : "Payments"),
      counterparty: direction === "in" ? payment.from_address : payment.to_address,
      description:
        direction === "in"
          ? `Received from ${short(payment.from_address)}`
          : `Paid ${payment.vendor_name || short(payment.to_address)}`,
      amount_usd: value,
      currency: "USD",
      occurred_at: payment.completed_at ?? payment.created_at,
      status: payment.status,
      metadata: { chain: payment.chain, txHash: payment.tx_hash },
    })
  }

  for (const invoice of invoices) {
    const value = amount(invoice.amount_fiat ?? invoice.amount)
    if (!value) continue
    const paid = invoice.status.toLowerCase() === "paid"
    rows.push({
      source: "invoice",
      source_id: invoice.id,
      dedupe_key: invoice.tx_hash ? `tx:${invoice.chain ?? "unknown"}:${invoice.tx_hash.toLowerCase()}` : `invoice:${invoice.id}`,
      kind: "income",
      direction: "in",
      category: paid ? "Invoices" : "Receivables",
      counterparty: invoice.customer_name || invoice.customer_email || invoice.customer_wallet || null,
      description: paid ? `Invoice ${invoice.invoice_id} paid` : `Invoice ${invoice.invoice_id} awaiting payment`,
      amount_usd: value,
      currency: "USD",
      occurred_at: invoice.paid_at ?? invoice.created_at,
      status: invoice.status,
      metadata: { invoiceId: invoice.invoice_id, txHash: invoice.tx_hash },
    })
  }

  for (const payment of subscriptionPayments) {
    const value = amount(payment.amount)
    if (!value) continue
    rows.push({
      source: "subscription",
      source_id: payment.id,
      dedupe_key: payment.tx_hash
        ? `tx:${payment.subscription.chain_id}:${payment.tx_hash.toLowerCase()}`
        : `subscription:${payment.id}`,
      kind: "expense",
      direction: "out",
      category: "Subscriptions",
      counterparty: payment.subscription.service_name,
      description: `Subscription · ${payment.subscription.service_name}`,
      amount_usd: value,
      currency: "USD",
      occurred_at: payment.created_at,
      status: payment.status,
      metadata: { chainId: payment.subscription.chain_id, txHash: payment.tx_hash },
    })
  }

  for (const payment of agentPayments) {
    const value = amount(payment.amount_usd)
    if (!value) continue
    rows.push({
      source: "agent",
      source_id: payment.id,
      dedupe_key: `agent:${payment.id}`,
      kind: "expense",
      direction: "out",
      category: "Agent spend",
      counterparty: payment.to_address,
      description: `Agent payment to ${short(payment.to_address)}`,
      amount_usd: value,
      currency: "USD",
      occurred_at: payment.confirmed_at ?? payment.created_at,
      status: payment.status,
      metadata: { chain: payment.chain, txHash: payment.tx_hash, orderId: payment.order_id },
    })
  }

  for (const order of acquiringOrders) {
    const value = amount(order.amount)
    if (!value) continue
    rows.push({
      source: "acquiring",
      source_id: order.id,
      dedupe_key: `acquiring:${order.id}`,
      kind: "income",
      direction: "in",
      category: "Acquiring",
      counterparty: order.payer_address || order.merchant.name,
      description: `${order.merchant.name} order ${order.order_no}`,
      amount_usd: value,
      currency: order.currency || "USD",
      occurred_at: order.paid_at ?? order.created_at,
      status: order.status,
      metadata: { orderNo: order.order_no, txHash: order.tx_hash },
    })
  }

  for (const trade of trades) {
    if (trade.status !== "closed" || trade.pnl === null) continue
    const pnl = Number(trade.pnl)
    if (!Number.isFinite(pnl) || pnl === 0) continue
    rows.push({
      source: "trade",
      source_id: trade.id,
      dedupe_key: `trade:${trade.id}`,
      kind: "trade",
      direction: pnl >= 0 ? "in" : "out",
      category: "Trading P&L",
      counterparty: trade.symbol,
      description: `${trade.symbol} ${trade.side} closed`,
      amount_usd: Number(Math.abs(pnl).toFixed(2)),
      currency: "USD",
      occurred_at: trade.closed_at ?? trade.opened_at,
      status: "completed",
      metadata: { symbol: trade.symbol, side: trade.side, fees: trade.fees, mode: trade.mode },
    })
  }

  await upsertRows(wallet, rows)
}

export interface CsvImportRow {
  occurredAt: Date
  description: string
  counterparty?: string | null
  amountUsd: number
  direction: "in" | "out"
  category?: string | null
  currency?: string | null
  reference?: string | null
  raw?: Record<string, unknown>
}

export async function importCsvTransactions(
  walletAddress: string,
  accountName: string,
  rows: CsvImportRow[],
): Promise<{ accountId: string; imported: number; inserted: number; fxConverted: number; fxMissing: number }> {
  const wallet = walletAddress.toLowerCase()
  const externalId = hash(accountName.trim().toLowerCase())
  const account = await prisma.financeAccount.upsert({
    where: {
      owner_address_source_external_id: {
        owner_address: wallet,
        source: "csv",
        external_id: externalId,
      },
    },
    create: {
      owner_address: wallet,
      name: accountName.trim().slice(0, 80) || "Imported account",
      kind: "bank",
      source: "csv",
      external_id: externalId,
      currency: "USD",
      metadata: { importedAt: new Date().toISOString() },
    },
    update: { name: accountName.trim().slice(0, 80) || "Imported account" },
  })

  let fxConverted = 0
  let fxMissing = 0
  const data: Prisma.FinanceTransactionCreateManyInput[] = await Promise.all(
    rows.map(async (row, index) => {
      const category = row.category || categorizeTransaction({
        description: row.description,
        counterparty: row.counterparty,
        kind: row.direction === "in" ? "income" : "expense",
      })
      const dedupeKey = `csv:${account.id}:${hash(
        [
          row.occurredAt.toISOString(),
          row.description,
          row.amountUsd.toFixed(2),
          row.direction,
          row.reference ?? "",
          index,
        ].join("|"),
      )}`
      const currency = (row.currency || "USD").toUpperCase()
      const conversion = await convertToUsd(row.amountUsd, currency)
      if (currency !== "USD") {
        if (conversion.converted) fxConverted += 1
        else fxMissing += 1
      }
      const raw = (row.raw ?? {}) as Record<string, unknown>
      return {
        owner_address: wallet,
        account_id: account.id,
        source: "csv",
        source_id: dedupeKey,
        dedupe_key: dedupeKey,
        kind: row.direction === "in" ? "income" : "expense",
        direction: row.direction,
        category,
        counterparty: row.counterparty ?? null,
        description: row.description,
        amount_usd: conversion.amountUsd,
        currency,
        occurred_at: row.occurredAt,
        status: "completed",
        metadata: {
          ...raw,
          fx: {
            originalAmount: row.amountUsd,
            currency,
            rate: conversion.rate,
            converted: conversion.converted,
          },
        } as Prisma.InputJsonValue,
      }
    }),
  )

  const result = await prisma.financeTransaction.createMany({ data, skipDuplicates: true })
  return {
    accountId: account.id,
    imported: data.length,
    inserted: result.count,
    fxConverted,
    fxMissing,
  }
}
