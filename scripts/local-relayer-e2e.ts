/**
 * Local relayer E2E — the settlement path subscriptions and x402 use.
 *
 * Proves that with only RELAYER_PRIVATE_KEY set (no hosted RELAYER_URL/API_KEY),
 * `relayerService.executeERC3009Transfer` submits a payer-signed EIP-3009
 * authorization on-chain: funds leave the payer's wallet, the relayer only
 * pays gas.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/local-relayer-e2e.ts
 */
import { Contract, JsonRpcProvider, Wallet, formatUnits } from "ethers"
import { getAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { isRelayerConfigured, relayerService } from "@/lib/services/relayer-service"
import {
  buildTransferAuthorizationTypedData,
  createTransferAuthorization,
  getTokenAddress,
} from "@/lib/erc3009"

const CHAIN_ID = 11155111
const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"
const USDC = getTokenAddress(CHAIN_ID, "USDC")!
const AMOUNT = "0.05"

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, note = "") => {
  if (ok) passed++
  else failed++
  console.log(`${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`)
}

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  const relayerPk = process.env.RELAYER_PRIVATE_KEY
  if (!pk || !relayerPk) throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY / RELAYER_PRIVATE_KEY missing")
  const payer = privateKeyToAccount(pk as `0x${string}`)
  const relayer = new Wallet(relayerPk)

  // No hosted relayer configured — only the local key.
  check("relayer reported configured (local key)", isRelayerConfigured(), `url=${process.env.RELAYER_URL ?? "-"} apiKey=${process.env.RELAYER_API_KEY ? "set" : "-"}`)

  const rpc = new JsonRpcProvider(RPC, undefined, { staticNetwork: true })
  const erc20 = new Contract(USDC, ["function balanceOf(address) view returns (uint256)"], rpc)
  const bal = async (address: string) => Number(formatUnits((await erc20.balanceOf(address)) as bigint, 6))

  const recipient = Wallet.createRandom().address
  const before = { payer: await bal(payer.address), relayer: await bal(relayer.address) }
  console.log(`before — payer ${before.payer} · relayer ${before.relayer} · recipient 0`)
  if (before.payer < Number(AMOUNT)) throw new Error(`payer holds ${before.payer} USDC, needs ${AMOUNT}`)

  // The payer signs ahead of time; the relayer submits.
  const authorization = createTransferAuthorization({
    from: payer.address,
    to: recipient,
    amount: AMOUNT,
    chainId: CHAIN_ID,
    tokenSymbol: "USDC",
  })
  const typed = buildTransferAuthorizationTypedData(CHAIN_ID, "USDC", authorization)
  const signature = await payer.signTypedData({
    domain: {
      name: typed.domain.name,
      version: typed.domain.version,
      chainId: typed.domain.chainId,
      verifyingContract: getAddress(typed.domain.verifyingContract),
    },
    types: typed.types,
    primaryType: "TransferWithAuthorization",
    message: typed.message,
  })

  const result = await relayerService.executeERC3009Transfer({
    chainId: CHAIN_ID,
    token: "USDC",
    from: payer.address as `0x${string}`,
    to: recipient as `0x${string}`,
    value: authorization.value.toString(),
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce as `0x${string}`,
    signature: signature as `0x${string}`,
  })
  check("relay submitted on-chain", result.status === "confirmed" && !!result.transactionHash, `status=${result.status} tx=${String(result.transactionHash).slice(0, 14)}...`)

  await new Promise((resolve) => setTimeout(resolve, 7000))
  const after = { payer: await bal(payer.address), relayer: await bal(relayer.address), recipient: await bal(recipient) }
  console.log(`after  — payer ${after.payer} · relayer ${after.relayer} · recipient ${after.recipient}`)
  check("payer funded it", Math.abs(before.payer - after.payer - Number(AMOUNT)) < 1e-9, `${before.payer} → ${after.payer}`)
  check("relayer untouched", Math.abs(after.relayer - before.relayer) < 1e-9, `${before.relayer} → ${after.relayer}`)
  check("recipient paid", Math.abs(after.recipient - Number(AMOUNT)) < 1e-9, `recipient=${after.recipient}`)

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
