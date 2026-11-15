import { createHash, randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { categorizeTransaction } from "./categorize"
import { convertToUsd } from "./fx"
import { collectYativoFiatCardRows } from "./providers/yativo-fiat"
import { syncUserBalances } from "@/lib/services/balance-sync-service"

const SYNC_MONTHS = 12
const CHUNK_SIZE = 40
const SYNC_INTERVAL_MS = 5 * 60_000
const SYNC_FAILURE_MS = 60_000

export interface FinanceLedgerRow {
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

function txKey(txHash: string | null | undefined, fallback: string): string {
  return txHash ? `tx:${txHash.toLowerCase()}` : fallback
}

function startOfMonthsAgo(months: number): Date {
  const date = new Date()
  date.setUTCDate(1)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCMonth(date.getUTCMonth() - months)
  return date
}

async function upsertRows(wallet: string, rows: FinanceLedgerRow[]): Promise<void> {
  const unique = new Map<string, FinanceLedgerRow>()
  for (const row of rows) {
    if (!row.amount_usd || !Number.isFinite(row.amount_usd)) continue
    unique.set(row.dedupe_key, row)
  }
  const values = [...unique.values()]

  for (let index = 0; index < values.length; index += CHUNK_SIZE) {
    const chunk = values.slice(index, index + CHUNK_SIZE)
    const params: unknown[] = []
    const tuples = chunk.map((row, rowIndex) => {
      const base = rowIndex * 15
      params.push(
        randomUUID(),
        wallet,
        row.source,
        row.source_id,
        row.dedupe_key,
        row.kind,
        row.direction,
        row.category,
        row.counterparty ?? null,
        row.description ?? null,
        row.amount_usd,
        row.currency,
        row.occurred_at,
        row.status.toLowerCase(),
        row.metadata ? JSON.stringify(row.metadata) : null,
      )
      const placeholders = Array.from({ length: 15 }, (_, column) => `$${base + column + 1}`)
      placeholders[14] = `${placeholders[14]}::jsonb`
      return `(${placeholders.join(", ")})`
    })

    await prisma.$executeRawUnsafe(
      `INSERT INTO finance_transactions
        (id, owner_address, source, source_id, dedupe_key, kind, direction, category,
         counterparty, description, amount_usd, currency, occurred_at, status, metadata)
       VALUES ${tuples.join(", ")}
       ON CONFLICT (owner_address, dedupe_key) DO UPDATE SET
         source = EXCLUDED.source,
         source_id = EXCLUDED.source_id,
         kind = EXCLUDED.kind,
         direction = EXCLUDED.direction,
         category = EXCLUDED.category,
         counterparty = EXCLUDED.counterparty,
         description = EXCLUDED.description,
         amount_usd = EXCLUDED.amount_usd,
         currency = EXCLUDED.currency,
         occurred_at = EXCLUDED.occurred_at,
         status = EXCLUDED.status,
         metadata = EXCLUDED.metadata`,
      ...params,
    )
  }
}

export async function upsertFinanceLedgerRows(walletAddress: string, rows: FinanceLedgerRow[]): Promise<void> {
  await upsertRows(walletAddress.toLowerCase(), rows)
}

async function syncFinanceLedgerInner(wallet: string): Promise<void> {
  const start = startOfMonthsAgo(SYNC_MONTHS)
  const balanceSync = syncUserBalances(wallet).catch((error) => {
    console.warn("[finance] balance sync failed:", error instanceof Error ? error.message : error)
  })

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

  const [payments, invoices, subscriptionPayments, agentPayments, acquiringOrders, cards, trades] = await Promise.all([
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
    prisma.corporateCard.findMany({
      where: { user: { wallet_address: { equals: wallet, mode: "insensitive" } } },
      include: {
        transactions: {
          where: { created_at: { gte: start } },
          orderBy: { created_at: "desc" },
          take: 1000,
        },
      },
    }),
    prisma.tradeRecord.findMany({
      where: { wallet_address: wallet },
      orderBy: { opened_at: "desc" },
      take: 1000,
    }),
  ])

  const rows: FinanceLedgerRow[] = []

  for (const payment of payments) {
    const direction = payment.from_address.toLowerCase() === wallet ? "out" : "in"
    const value = amount(payment.amount_usd ?? payment.amount)
    if (!value) continue
    rows.push({
      source: "payment",
      source_id: payment.id,
      dedupe_key: txKey(payment.tx_hash, `payment:${payment.id}`),
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
    const fiatCurrency = invoice.fiat_currency?.toUpperCase()
    const value = amount(fiatCurrency === "USD" ? invoice.amount_fiat ?? invoice.amount : invoice.amount)
    if (!value) continue
    const paid = invoice.status.toLowerCase() === "paid"
    rows.push({
      source: "invoice",
      source_id: invoice.id,
      dedupe_key: txKey(invoice.tx_hash, `invoice:${invoice.id}`),
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
      dedupe_key: txKey(payment.tx_hash, `subscription:${payment.id}`),
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
      dedupe_key: txKey(payment.tx_hash, `agent:${payment.id}`),
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
      dedupe_key: txKey(order.tx_hash, `acquiring:${order.id}`),
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

  for (const card of cards) {
    for (const transaction of card.transactions) {
      const type = transaction.type.toUpperCase()
      if (type !== "SETTLEMENT" && type !== "REFUND") continue
      if (transaction.status.toUpperCase() === "DECLINED") continue
      const value = amount(transaction.amount)
      if (!value) continue
      const direction = type === "REFUND" ? "in" : "out"
      rows.push({
        source: "card",
        source_id: transaction.id,
        dedupe_key: `card:${transaction.external_id}`,
        kind: direction === "in" ? "income" : "expense",
        direction,
        category:
          transaction.merchant_category ||
          categorizeTransaction({
            description: transaction.merchant_name,
            counterparty: transaction.merchant_name,
            kind: direction === "in" ? "income" : "expense",
          }),
        counterparty: transaction.merchant_name,
        description: `${transaction.merchant_name || "Card"} ${type.toLowerCase()}`,
        amount_usd: value,
        currency: transaction.currency || "USD",
        occurred_at: transaction.created_at,
        status: transaction.status,
        metadata: { cardLast4: card.last4, type, currency: transaction.currency },
      })
    }
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

  const yativo = await collectYativoFiatCardRows(wallet).catch(() => null)
  if (yativo?.rows.length) rows.push(...yativo.rows)

  await upsertRows(wallet, rows)
  await balanceSync
}

export async function syncFinanceLedger(walletAddress: string, force = false): Promise<void> {
  const wallet = walletAddress.toLowerCase()
  const state = force
    ? null
    : await prisma.financeSyncState.findUnique({ where: { wallet_address: wallet } }).catch(() => null)
  const now = Date.now()
  if (!force && state?.last_synced_at && now - state.last_synced_at.getTime() < SYNC_INTERVAL_MS) return
  if (!force && state?.last_error_at && now - state.last_error_at.getTime() < SYNC_FAILURE_MS) return

  try {
    await syncFinanceLedgerInner(wallet)
    await prisma.financeSyncState.upsert({
      where: { wallet_address: wallet },
      create: { wallet_address: wallet, last_synced_at: new Date() },
      update: { last_synced_at: new Date(), last_error_at: null, last_error: null },
    })
  } catch (error) {
    await prisma.financeSyncState
      .upsert({
        where: { wallet_address: wallet },
        create: {
          wallet_address: wallet,
          last_error_at: new Date(),
          last_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        },
        update: {
          last_error_at: new Date(),
          last_error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        },
      })
      .catch(() => undefined)
    throw error
  }
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
  const seen = new Map<string, number>()
  const data: Prisma.FinanceTransactionCreateManyInput[] = await Promise.all(
    rows.map(async (row) => {
      const category = row.category || categorizeTransaction({
        description: row.description,
        counterparty: row.counterparty,
        kind: row.direction === "in" ? "income" : "expense",
      })
      const base = hash(
        [
          row.occurredAt.toISOString(),
          row.description,
          row.amountUsd.toFixed(2),
          row.direction,
          row.counterparty ?? "",
          row.currency ?? "USD",
          row.reference ?? "",
        ].join("|"),
      )
      const occurrence = (seen.get(base) ?? 0) + 1
      seen.set(base, occurrence)
      const dedupeKey = `csv:${account.id}:${base}:${occurrence}`
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
