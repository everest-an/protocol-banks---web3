/**
 * Fund Hyperliquid from the agent test wallet (Arbitrum one-way deposit).
 *
 * Per the official bridge docs the deposit flow is a plain ERC-20 transfer of
 * native USDC to the Bridge2 contract:
 *   - Bridge2 (Arbitrum): 0x2df1c51e09aecf9cacb7bc98cb1742757f163df7
 *   - "The user sends native USDC to the bridge, and it is credited to the
 *     account that sent it in less than 1 minute."
 *   - "The minimum deposit amount is 5 USDC. If you send an amount less than
 *     this, it will not be credited and be lost forever."
 *
 * That last line is why this script hard-refuses anything below 5 USDC and is
 * dry-run by default.
 *
 * Usage (dry run — prints the plan, sends nothing):
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/fund-hyperliquid.ts
 *
 * Execute:
 *   $env:CONFIRM_DEPOSIT='1'; $env:DEPOSIT_USDC='5.5'; npx tsx -r dotenv/config scripts/fund-hyperliquid.ts
 *
 * Options (env):
 *   DEPOSIT_USDC     amount to deposit          (default 5.5)
 *   CONFIRM_DEPOSIT  set to 1 to actually send  (default: dry run)
 *   ARBITRUM_RPC_URL override the RPC endpoint
 */

import { Wallet, JsonRpcProvider, Contract, parseUnits, formatUnits } from "ethers"
import { getHyperliquidNetworkConfig } from "@/lib/trading/network"

const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc"
const USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" // native USDC
const BRIDGE2 = "0x2df1c51e09aecf9cacb7bc98cb1742757f163df7" // Hyperliquid Bridge2
const MIN_DEPOSIT_USDC = 5 // below this the venue keeps the funds
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
]

async function hyperliquidAccountValue(address: string): Promise<number | null> {
  try {
    const res = await fetch(getHyperliquidNetworkConfig().infoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: address }),
      signal: AbortSignal.timeout(10_000),
    })
    const body = (await res.json()) as { marginSummary?: { accountValue?: string } }
    return Number(body.marginSummary?.accountValue ?? 0)
  } catch {
    return null
  }
}

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
    throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing or malformed (.env.local)")
  }
  const wallet = new Wallet(pk)
  const provider = new JsonRpcProvider(ARBITRUM_RPC, undefined, { staticNetwork: true })
  const usdc = new Contract(USDC_ARBITRUM, ERC20_ABI, provider)

  const amount = Number(process.env.DEPOSIT_USDC ?? "5.5")
  console.log(`wallet      : ${wallet.address}`)
  console.log(`network     : arbitrum one (${ARBITRUM_RPC})`)
  console.log(`hl network  : ${getHyperliquidNetworkConfig().network}`)

  const [usdcBalRaw, ethBal, decimals] = await Promise.all([
    usdc.balanceOf(wallet.address) as Promise<bigint>,
    provider.getBalance(wallet.address),
    usdc.decimals() as Promise<bigint>,
  ])
  const usdcBal = Number(formatUnits(usdcBalRaw, Number(decimals)))
  const eth = Number(formatUnits(ethBal, 18))
  const gasPrice = await provider.getFeeData()

  console.log(`USDC balance: ${usdcBal}`)
  console.log(`ETH balance : ${eth} (needed for gas)`)
  console.log(`deposit     : ${amount} USDC -> Bridge2 ${BRIDGE2}`)

  // --- guards -------------------------------------------------------------
  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_USDC) {
    throw new Error(
      `refusing: ${amount} USDC is below the ${MIN_DEPOSIT_USDC} USDC minimum — the docs say a smaller amount is "not credited and lost forever"`,
    )
  }
  if (usdcBal < amount) {
    throw new Error(`insufficient USDC: have ${usdcBal}, need ${amount}. Send USDC on Arbitrum to ${wallet.address} first.`)
  }
  if (eth === 0) {
    throw new Error(
      `no ETH for gas on Arbitrum. A USDC transfer needs a little ETH — send ~0.0005 ETH to ${wallet.address} as well.`,
    )
  }

  const feeEstimate = gasPrice.maxFeePerGas ?? gasPrice.gasPrice ?? 0n
  console.log(`gas price   : ${formatUnits(feeEstimate, 9)} gwei (max) — a transfer uses ~50k gas`)

  if (process.env.CONFIRM_DEPOSIT !== "1") {
    console.log("\nDRY RUN — nothing sent. Re-run with CONFIRM_DEPOSIT=1 to execute.")
    return
  }

  console.log("\nsending…")
  const signer = wallet.connect(provider)
  const tx = await (usdc.connect(signer) as Contract).transfer(BRIDGE2, parseUnits(String(amount), Number(decimals)))
  console.log(`tx: ${tx.hash}`)
  const receipt = await tx.wait()
  console.log(`mined in block ${receipt?.blockNumber} (status ${receipt?.status})`)

  console.log("\nwaiting for the venue to credit the account (usually < 1 min)…")
  for (let i = 1; i <= 20; i++) {
    await new Promise((r) => setTimeout(r, 15_000))
    const value = await hyperliquidAccountValue(wallet.address)
    if (value === null) {
      console.log(`  ${i}: info API unreachable`)
      continue
    }
    console.log(`  ${i}: accountValue = ${value}`)
    if (value > 0) {
      console.log("\n✅ credited. The faucet gate (prior mainnet deposit) is now satisfied for this address.")
      return
    }
  }
  console.log("\n⚠️  not credited after 5 minutes — check the bridge docs/explorer before retrying")
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
