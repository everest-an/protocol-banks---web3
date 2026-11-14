import { prisma } from "@/lib/prisma"
import { categorizeTransaction } from "../categorize"
import type { FinanceLedgerRow } from "../ledger"

const BASE = process.env.YATIVO_FIAT_BASE_URL || "https://api.yativo.com/api/v1"
const KEY = process.env.YATIVO_FIAT_API_KEY || ""
const SECRET = process.env.YATIVO_FIAT_API_SECRET || ""

interface YativoCardTransaction {
  transaction_id: string
  amount: string
  currency: string
  merchant_name?: string
  merchant_category?: string
  status: string
  created_at: string
}

export function isYativoFiatConfigured(): boolean {
  return Boolean(KEY && SECRET)
}

async function fiatFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "X-Api-Key": KEY, "X-Api-Secret": SECRET, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  })
  const body = (await response.json().catch(() => ({}))) as T & { message?: string }
  if (!response.ok) throw new Error(body?.message || `Yativo fiat HTTP ${response.status}`)
  return body
}

async function cardTransactions(cardId: string): Promise<YativoCardTransaction[]> {
  const body = await fiatFetch<{ data?: YativoCardTransaction[] }>(
    `/customer/virtual/cards/transactions/${encodeURIComponent(cardId)}`,
  )
  return Array.isArray(body.data) ? body.data : []
}

export async function collectYativoFiatCardRows(
  walletAddress: string,
): Promise<{ configured: boolean; cards: number; rows: FinanceLedgerRow[]; failed: number }> {
  if (!isYativoFiatConfigured()) return { configured: false, cards: 0, rows: [], failed: 0 }

  const wallet = walletAddress.toLowerCase()
  const [userCards, agentCards] = await Promise.all([
    prisma.userVirtualCard.findMany({
      where: { owner_address: wallet, card_provider: "YATIVO" },
      select: { provider_card_id: true, last4: true },
    }),
    prisma.agentVirtualCard.findMany({
      where: { owner_address: wallet, card_provider: "YATIVO" },
      select: { provider_card_id: true, last4: true },
    }),
  ])

  const cards = [...userCards, ...agentCards]
  const rows: FinanceLedgerRow[] = []
  let failed = 0

  for (const card of cards) {
    try {
      const transactions = await cardTransactions(card.provider_card_id)
      for (const transaction of transactions) {
        const signed = Number(transaction.amount)
        if (!Number.isFinite(signed) || signed === 0) continue
        const direction = signed < 0 ? "in" : "out"
        const value = Math.abs(signed)
        rows.push({
          source: "yativo_card",
          source_id: transaction.transaction_id,
          dedupe_key: `yativo-card:${transaction.transaction_id}`,
          kind: direction === "in" ? "income" : "expense",
          direction,
          category:
            transaction.merchant_category ||
            categorizeTransaction({
              description: transaction.merchant_name,
              counterparty: transaction.merchant_name,
              kind: direction === "in" ? "income" : "expense",
            }),
          counterparty: transaction.merchant_name ?? null,
          description: `${transaction.merchant_name || "Yativo card"} ${transaction.status}`,
          amount_usd: Number(value.toFixed(2)),
          currency: transaction.currency || "USD",
          occurred_at: new Date(transaction.created_at),
          status: transaction.status,
          metadata: { cardLast4: card.last4, provider: "YATIVO" },
        })
      }
    } catch (error) {
      failed += 1
      console.warn("[finance/yativo] card sync failed:", error instanceof Error ? error.message : error)
    }
  }

  return { configured: true, cards: cards.length, rows, failed }
}
