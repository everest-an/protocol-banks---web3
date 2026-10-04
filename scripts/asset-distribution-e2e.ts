/**
 * Asset distribution E2E — post-payment NFT/token hand-out path.
 *
 * Requires the distributor wallet (scripts/setup-asset-distributor.ts) funded
 * with Sepolia ETH + USDC.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/asset-distribution-e2e.ts
 */
import { Contract, JsonRpcProvider, Wallet, formatUnits } from "ethers"
import { checkAssetAvailability, distributeAsset, type AssetDistributionConfig } from "@/lib/asset-distribution"
import { getTokenAddress } from "@/lib/erc3009"

const CHAIN_ID = 11155111
const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"
const USDC = getTokenAddress(CHAIN_ID, "USDC")!
const AMOUNT = "0.01"

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, note = "") => {
  if (ok) passed++
  else failed++
  console.log(`${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`)
}

async function main() {
  const distributorAddress = process.env.ASSET_DISTRIBUTOR_ADDRESS
  const distributorPrivateKey = process.env.ASSET_DISTRIBUTOR_PRIVATE_KEY
  if (!distributorAddress || !distributorPrivateKey) {
    throw new Error("ASSET_DISTRIBUTOR_* missing — run scripts/setup-asset-distributor.ts first")
  }

  const recipient = Wallet.createRandom().address
  const rpc = new JsonRpcProvider(RPC, undefined, { staticNetwork: true })
  const erc20 = new Contract(USDC, ["function balanceOf(address) view returns (uint256)"], rpc)
  const bal = async (address: string) => Number(formatUnits((await erc20.balanceOf(address)) as bigint, 6))

  const before = { distributor: await bal(distributorAddress), recipient: await bal(recipient) }
  console.log(`before — distributor ${before.distributor} · recipient ${before.recipient}`)

  // Negative: asking for more than the distributor holds must be refused.
  const unavailable = await checkAssetAvailability({
    assetType: "token",
    contractAddress: USDC,
    chainId: CHAIN_ID,
    amount: "100",
    distributorAddress,
  })
  check("availability guard refuses over-balance", unavailable.available === false, String(unavailable.error ?? ""))

  // Positive: the held amount is available.
  const available = await checkAssetAvailability({
    assetType: "token",
    contractAddress: USDC,
    chainId: CHAIN_ID,
    amount: AMOUNT,
    distributorAddress,
  })
  check("availability confirms held amount", available.available === true, String(available.error ?? "ok"))

  const config: AssetDistributionConfig = {
    assetType: "token",
    contractAddress: USDC,
    chainId: CHAIN_ID,
    amount: AMOUNT,
    distributorAddress,
    distributorPrivateKey,
  }
  const result = await distributeAsset(config, recipient)
  check("distributed on-chain", result.success === true && !!result.txHash, result.error ?? String(result.txHash))

  await new Promise((resolve) => setTimeout(resolve, 7000))
  const after = { distributor: await bal(distributorAddress), recipient: await bal(recipient) }
  console.log(`after  — distributor ${after.distributor} · recipient ${after.recipient}`)
  check(
    "distributor paid the asset",
    Math.abs(before.distributor - after.distributor - Number(AMOUNT)) < 1e-9,
    `${before.distributor} → ${after.distributor}`,
  )
  check(
    "recipient received the asset",
    Math.abs(after.recipient - before.recipient - Number(AMOUNT)) < 1e-9,
    `recipient=${after.recipient}`,
  )

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
