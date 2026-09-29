/**
 * Flatten every open position on the agent test wallet.
 *
 * Testnet bookkeeping: an IOC reduce-only close can leave one tick behind
 * (the venue reports sizes rounded to szDecimals, so the real position may be a
 * hair larger than orderable), and an order whose response is lost still fills.
 * This loops until the account is flat, so the next test starts clean.
 *
 *   $env:HYPERLIQUID_NETWORK='testnet'; npx tsx -r dotenv/config scripts/flatten-test-wallet.ts
 */

import { Wallet } from "ethers"
import { placeMarketOrder, getUserState } from "@/lib/trading/exchange"
import { getAgentWallet } from "@/lib/trading/keys"
import { getHyperliquidNetworkConfig } from "@/lib/trading/network"

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing or malformed")
  const wallet = new Wallet(pk)
  const cfg = getHyperliquidNetworkConfig()
  const agentWallet = getAgentWallet(wallet.address)
  if (!agentWallet) throw new Error("no local agent key for this wallet")

  console.log(`network: ${cfg.network} | wallet: ${wallet.address}`)

  for (let pass = 1; pass <= 6; pass++) {
    const state = await getUserState(wallet.address)
    const open = (state?.assetPositions ?? []).filter((p) => Number(p.position.szi) !== 0)
    if (open.length === 0) {
      console.log(`✅ flat after ${pass - 1} close(s). accountValue = ${state?.marginSummary?.accountValue ?? "?"}`)
      return
    }
    for (const p of open) {
      const szi = Number(p.position.szi)
      console.log(`  pass ${pass}: ${p.position.coin} ${p.position.szi} — closing`)
      try {
        const res = await placeMarketOrder({
          agentWallet,
          vaultAddress: null,
          coin: p.position.coin,
          isBuy: szi < 0,
          sizeUsd: Math.abs(szi) * Number(p.position.entryPx ?? 0) || 11,
          sizeCoins: Math.abs(szi),
          reduceOnly: true,
        })
        console.log(`    ${JSON.stringify(res).slice(0, 160)}`)
      } catch (e) {
        console.log(`    ⚠️  ${e instanceof Error ? e.message : String(e)} (may still have filled — re-checking)`)
      }
    }
    await new Promise((r) => setTimeout(r, 4000))
  }

  const last = await getUserState(wallet.address)
  const remaining = (last?.assetPositions ?? []).filter((p) => Number(p.position.szi) !== 0)
  console.log(remaining.length ? `⚠️  still open: ${JSON.stringify(remaining)}` : "✅ flat")
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
