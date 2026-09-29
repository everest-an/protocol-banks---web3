/**
 * Claim the Hyperliquid testnet faucet for the agent test wallet.
 *
 * The web app's `/drip` page only POSTs `{ type: "claimDrip", user }` — no
 * signature, no wallet — so this can be driven from a script. The venue gate is
 * the blocker, not the mechanism:
 *
 *   "Cannot claim drip because user 0x… does not exist on mainnet."
 *
 * Run this after the address has a mainnet account (see fund-hyperliquid.ts).
 * Safe to re-run: a refusal just prints the venue's reason.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/claim-drip.ts
 */

import { Wallet } from "ethers"
import { claimTestnetDrip } from "./lib/testnet-faucet"

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
    throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing or malformed (.env.local)")
  }
  const wallet = new Wallet(pk)
  console.log(`claiming the testnet drip for ${wallet.address} …`)
  const res = await claimTestnetDrip(wallet.address)
  console.log(res.ok ? `✅ ${res.detail}` : `⚠️  ${res.detail}`)
  if (!res.ok) process.exitCode = 1
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
