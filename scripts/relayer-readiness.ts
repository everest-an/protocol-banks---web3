/**
 * Relayer gas readiness — which chains the payout relayer can pay gas on.
 *
 * The relayer signs the submissions for batch payouts, subscription charges and
 * x402 settlement, so it needs a little native currency on every chain that is
 * meant to be live (it never holds user funds). This prints the balance per
 * supported EVM network and flags the ones that need a top-up.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/relayer-readiness.ts
 *
 * To check the *production* key, pull it into a temporary env file first:
 *   npx vercel env pull .env.prod.tmp --environment=production --yes
 *   $env:DOTENV_CONFIG_PATH='.env.prod.tmp'; npx tsx -r dotenv/config scripts/relayer-readiness.ts
 *   Remove-Item .env.prod.tmp
 */
import { JsonRpcProvider, Wallet, formatEther } from "ethers"
import { EVM_NETWORKS } from "@/lib/networks"

/** Enough native currency for more than a handful of sponsored transactions. */
const MIN_GAS: Record<string, number> = { ETH: 0.002, MATIC: 0.5, BNB: 0.005 }

let missing = 0

/** Public RPCs occasionally hang; a slow chain must not stall the report. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} RPC timed out`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function main() {
  const privateKey = process.env.RELAYER_PRIVATE_KEY
  if (!privateKey) throw new Error("RELAYER_PRIVATE_KEY missing")
  if (privateKey.includes("[SENSITIVE]")) {
    throw new Error(
      "RELAYER_PRIVATE_KEY is a masked Vercel placeholder — `vercel env pull` does not decrypt " +
        "sensitive values. Paste the key manually, or run against .env.local.",
    )
  }
  const relayer = new Wallet(privateKey)
  console.log(`relayer ${relayer.address}\n`)

  for (const network of Object.values(EVM_NETWORKS)) {
    const symbol = network.nativeCurrency?.symbol ?? "ETH"
    const minimum = MIN_GAS[symbol] ?? 0.002
    try {
      const provider = new JsonRpcProvider(network.rpcUrl, undefined, { staticNetwork: true })
      const balance = await withTimeout(provider.getBalance(relayer.address), 8000, network.name)
      const balanceFloat = Number(formatEther(balance))
      const funded = balanceFloat >= minimum
      if (!funded && !network.isTestnet) missing++
      console.log(
        `${funded ? "✅" : "⚠️ "} ${network.name.padEnd(18)} ${balanceFloat.toFixed(6)} ${symbol}` +
          (funded ? "" : ` — needs ≈ ${minimum} ${symbol}${network.isTestnet ? " (testnet)" : ""}`),
      )
    } catch (error) {
      missing++
      console.log(`❌ ${network.name.padEnd(18)} RPC error: ${String((error as Error)?.message ?? error).slice(0, 60)}`)
    }
  }

  console.log(`\n${missing === 0 ? "relayer funded on every live chain" : `${missing} mainnet chain(s) need gas`}`)
  console.log(`fund: ${relayer.address}`)
  process.exit(0)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
