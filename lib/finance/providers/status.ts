import { prisma } from "@/lib/prisma"
import { isYativoFiatConfigured } from "./yativo-fiat"

export interface FinanceProviderStatus {
  yativoFiat: { configured: boolean; cards: number }
  rain: { cards: number; transactions: number }
  csv: { accounts: number }
  bank: { mode: "csv"; connected: false }
  onchain: { history: boolean; chains: string[] }
}

export async function getFinanceProviderStatus(walletAddress: string): Promise<FinanceProviderStatus> {
  const wallet = walletAddress.toLowerCase()
  const [yativoUserCards, yativoAgentCards, rainCards, rainTransactions, csvAccounts] = await Promise.all([
    prisma.userVirtualCard.count({ where: { owner_address: wallet, card_provider: "YATIVO" } }),
    prisma.agentVirtualCard.count({ where: { owner_address: wallet, card_provider: "YATIVO" } }),
    prisma.corporateCard.count({
      where: { user: { wallet_address: { equals: wallet, mode: "insensitive" } } },
    }),
    prisma.cardTransaction.count({
      where: { card: { user: { wallet_address: { equals: wallet, mode: "insensitive" } } } },
    }),
    prisma.financeAccount.count({ where: { owner_address: wallet, source: "csv" } }),
  ])

  const history = process.env.ONCHAIN_HISTORY_ENABLED !== "false"
  const configuredChains = process.env.ONCHAIN_HISTORY_CHAINS
  const chains = configuredChains
    ? configuredChains.split(",").map((chain) => chain.trim()).filter(Boolean)
    : ["ethereum", "arbitrum", "polygon", "optimism"]

  return {
    yativoFiat: { configured: isYativoFiatConfigured(), cards: yativoUserCards + yativoAgentCards },
    rain: { cards: rainCards, transactions: rainTransactions },
    csv: { accounts: csvAccounts },
    bank: { mode: "csv", connected: false },
    onchain: { history, chains },
  }
}
