/**
 * Run the product's own agent loop headlessly against Hyperliquid testnet.
 *
 * This is the whole product behaviour in one process: market scan → momentum /
 * funding signals → risk engine → real orders → ledger → activity feed.
 *
 * Deliberately out-of-band from the app's go-live state: the account stays
 * `paper` in the DB (persistStateToDb only writes state_json), so nothing
 * appears on the public track record, and the funds are faucet USDC rather than
 * real money. The order path itself is the same code the live product uses.
 *
 *   $env:HYPERLIQUID_NETWORK='testnet'; npx tsx -r dotenv/config scripts/testnet-agent-run.ts
 *
 * Options (env):
 *   AGENT_TICKS        number of ticks to run          (default 5)
 *   AGENT_GAP_MS       pause between ticks             (default 20000)
 *   AGENT_BUDGET_USD   ledger budget; default = venue account value
 *   ALLOW_MAINNET=1    permit a mainnet run (refused otherwise)
 */

import { Wallet } from "ethers"
import { TradingAgent } from "@/lib/trading/agent"
import { LiveOrderExecutor } from "@/lib/trading/live-executor"
import { getStoreForWallet, promoteToLiveLedger } from "@/lib/trading/store"
import { DEFAULT_RISK } from "@/lib/trading/risk"
import { getHyperliquidNetworkConfig } from "@/lib/trading/network"
import { getUserState } from "@/lib/trading/exchange"

function short(text: string, n = 130) {
  return text.length > n ? `${text.slice(0, n)}…` : text
}

/**
 * The venue is the source of truth for what is actually open.
 *
 * The ledger is local state; if it is ever lost, reset or written by another
 * process it will disagree with the venue, and the agent will happily re-open a
 * market it already holds (observed for real: two runs doubled an ETH long).
 * The threat model lists this as "ledger drift" — this is the mitigation, done
 * on every start.
 */
async function reconcileLedger(
  walletAddress: string,
  store: ReturnType<typeof getStoreForWallet>,
  accountValue: number,
): Promise<number> {
  const state = await getUserState(walletAddress)
  const open = (state?.assetPositions ?? []).filter((p) => Number(p.position.szi) !== 0)
  const openMargin = open.reduce((sum, { position }) => sum + Number(position.marginUsed ?? 0), 0)
  store.mutate((s) => {
    s.positions = open.map(({ position }) => {
      const size = Math.abs(Number(position.szi))
      const allocated = Number(position.marginUsed ?? 0)
      const pnl = Number(position.unrealizedPnl ?? 0)
      return {
        symbol: position.coin,
        side: Number(position.szi) > 0 ? ("long" as const) : ("short" as const),
        size,
        entry: Number(position.entryPx ?? 0),
        mark: size > 0 ? Number(position.positionValue ?? 0) / size : 0,
        allocated,
        pnl,
        pnlPct: allocated > 0 ? (pnl / allocated) * 100 : 0,
        leverage: Number(position.leverage?.value ?? 1),
        reason: "reconciled from venue on startup",
        openedAt: new Date().toISOString(),
      }
    })
    // Equity is a venue fact too: cash is what is left once the open positions
    // have taken their margin.
    s.cash = Math.max(0, accountValue - openMargin)
    s.account.totalEquity = accountValue
    s.account.tradingWallet = accountValue
    s.initialEquity = accountValue
    s.todayStartEquity = accountValue
    s.equity = [{ t: new Date().toISOString().slice(0, 10), v: accountValue }]
  })
  return open.length
}

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing or malformed")
  const wallet = new Wallet(pk)
  const cfg = getHyperliquidNetworkConfig()

  console.log(`network : ${cfg.network} (${cfg.infoUrl})`)
  console.log(`wallet  : ${wallet.address}`)
  if (cfg.isMainnet && process.env.ALLOW_MAINNET !== "1") {
    throw new Error("Refusing to run the agent against MAINNET. Set ALLOW_MAINNET=1 if you mean it.")
  }

  const ticks = Number(process.env.AGENT_TICKS ?? "5")
  const gapMs = Number(process.env.AGENT_GAP_MS ?? "20000")

  const venue = await getUserState(wallet.address)
  const venueValue = Number(venue?.marginSummary?.accountValue ?? 0)
  const budget = Number(process.env.AGENT_BUDGET_USD ?? (venueValue > 0 ? venueValue : 1000))
  console.log(`venue   : accountValue ${venueValue}, positions ${venue?.assetPositions?.length ?? 0}`)
  console.log(`budget  : ${budget} (ledger)`)

  // The venue is the source of truth, so the harness rebuilds its live ledger
  // from the venue on every start rather than trusting local state. Running the
  // real product keeps a persistent ledger; here a fresh, reconciled one is the
  // safest thing to hand the agent.
  const store = getStoreForWallet(wallet.address)
  store.mutate((s) => {
    Object.assign(s, promoteToLiveLedger(s, budget))
  })
  const reconciled = await reconcileLedger(wallet.address, store, venueValue > 0 ? venueValue : budget)
  console.log(`ledger  : live, budget ${budget.toFixed(2)}; reconciled with venue — ${reconciled} open position(s)`)

  const executor = new LiveOrderExecutor({ walletAddress: wallet.address, vaultAddress: null })
  console.log(`agent   : executor ready = ${executor.isReady()} (approved agent key on file)`)

  const agent = new TradingAgent(store, DEFAULT_RISK, wallet.address, { mode: "live", executor })

  for (let i = 1; i <= ticks; i++) {
    console.log(`\n──────── tick ${i}/${ticks} ────────`)
    const started = Date.now()
    await agent.tick()
    const s = agent.toOverview()
    console.log(
      `equity ${s.account.totalEquity.toFixed(2)} | positions ${s.positions.length} | allTimePnl ${s.account.allTimePnl.toFixed(4)} | ${Date.now() - started}ms`,
    )
    for (const p of s.positions) {
      console.log(`   position: ${p.symbol} ${p.side} size=${p.size} entry=${p.entry} mark=${p.mark} pnl=${p.pnl.toFixed(4)}`)
    }
    for (const a of s.activity.slice(0, 3)) {
      console.log(`   [${a.type}] ${short(a.text)}`)
    }
    if (i < ticks) await new Promise((r) => setTimeout(r, gapMs))
  }

  const after = await getUserState(wallet.address)
  console.log(`\n──────── venue after ────────`)
  console.log(`accountValue ${after?.marginSummary?.accountValue ?? "?"}`)
  const positions = (after?.assetPositions ?? []).filter((p) => Number(p.position.szi) !== 0)
  if (positions.length === 0) {
    console.log("positions: none (flat)")
  } else {
    for (const p of positions) {
      console.log(`   ${p.position.coin} szi=${p.position.szi} entry=${p.position.entryPx} uPnl=${p.position.unrealizedPnl}`)
    }
    console.log("(the agent owns these — it will manage exits on later ticks; flatten with scripts/flatten-test-wallet.ts if needed)")
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
