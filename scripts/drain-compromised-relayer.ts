/**
 * Drain the compromised development relayer into a safe destination.
 *
 * The dev relayer's private key was exposed in plain text, so any balance left
 * on it can be taken by anyone. This moves each chain's native balance (minus a
 * gas reserve) to a destination wallet — by default the new production relayer,
 * which needs exactly this gas.
 *
 *   # plan only (default) — nothing is broadcast
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/drain-compromised-relayer.ts
 *   # execute
 *   ... scripts/drain-compromised-relayer.ts --confirm
 *
 * Destination override: FUND_DESTINATION=0x...
 */
import { JsonRpcProvider, Wallet, formatEther, parseEther } from "ethers"
import { EVM_NETWORKS } from "@/lib/networks"

const DEFAULT_DESTINATION = "0xA168d1e3e467394501681f4064361acC7D4FD2BF" // production relayer
const DESTINATION = process.env.FUND_DESTINATION ?? DEFAULT_DESTINATION
const CONFIRM = process.argv.includes("--confirm")

/** Gas reserve kept back per chain so the transfer itself can pay for gas. */
const RESERVE: Record<string, string> = { ETH: "0.0003", MATIC: "0.02", BNB: "0.0003", HSK: "0.002" }
/** Below this, moving the balance costs more than it is worth. */
const DUST: Record<string, string> = { ETH: "0.0002", MATIC: "0.05", BNB: "0.0001", HSK: "0.001" }

async function main() {
  const privateKey = process.env.RELAYER_PRIVATE_KEY
  if (!privateKey) throw new Error("RELAYER_PRIVATE_KEY missing")
  if (privateKey.includes("[SENSITIVE]")) throw new Error("RELAYER_PRIVATE_KEY is a masked placeholder")

  console.log(`source      ${new Wallet(privateKey).address}`)
  console.log(`destination ${DESTINATION}`)
  console.log(CONFIRM ? "mode        EXECUTE\n" : "mode        dry-run (pass --confirm to broadcast)\n")

  for (const network of Object.values(EVM_NETWORKS)) {
    if (network.isTestnet) continue
    const symbol = network.nativeCurrency?.symbol ?? "ETH"
    const reserve = parseEther(RESERVE[symbol] ?? "0.0003")
    const dust = parseEther(DUST[symbol] ?? "0.0001")

    try {
      const provider = new JsonRpcProvider(network.rpcUrl, undefined, { staticNetwork: true })
      const wallet = new Wallet(privateKey, provider)
      const balance = await provider.getBalance(wallet.address)

      if (balance <= dust) {
        console.log(`·  ${network.name.padEnd(18)} ${formatEther(balance)} ${symbol} — below dust, skipped`)
        continue
      }
      const sendable = balance - reserve
      if (sendable <= 0n) {
        console.log(`·  ${network.name.padEnd(18)} ${formatEther(balance)} ${symbol} — below gas reserve, skipped`)
        continue
      }

      console.log(`→  ${network.name.padEnd(18)} send ${formatEther(sendable)} ${symbol} (keep ${formatEther(reserve)})`)
      if (!CONFIRM) continue

      const tx = await wallet.sendTransaction({ to: DESTINATION, value: sendable })
      await tx.wait()
      console.log(`   confirmed ${tx.hash}`)
    } catch (error) {
      console.log(`❌ ${network.name.padEnd(18)} ${String((error as Error)?.message ?? error).slice(0, 90)}`)
    }
  }

  console.log(CONFIRM ? "\ndone" : "\nre-run with --confirm to broadcast")
  process.exit(0)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
