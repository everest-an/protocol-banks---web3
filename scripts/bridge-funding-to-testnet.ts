/**
 * Move the owner-supplied funding wallet's ETH onto the agent test wallet
 * (Ethereum → Arbitrum), via LI.FI's public quote API.
 *
 * Two transfers, because the destination needs both:
 *   1. ETH → USDC on Arbitrum   (the budget for the Hyperliquid deposit)
 *   2. ETH → ETH on Arbitrum    (gas for that deposit transaction)
 *
 * Safety:
 *   - dry run by default; `CONFIRM_BRIDGE=1` is required to sign anything
 *   - amounts are explicit and must leave enough ETH for gas
 *   - the quote's target contract is printed before signing
 *
 * The private key is read from FUNDING_WALLET_PRIVATE_KEY (.env.local) and is
 * never printed.
 */

import { Wallet, JsonRpcProvider, formatEther } from "ethers"

const ETHEREUM_RPC = process.env.ETHEREUM_RPC_URL ?? "https://ethereum-rpc.publicnode.com"
const LI_FI = "https://li.quest/v1"
const ZERO = "0x0000000000000000000000000000000000000000"
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
const ARB_CHAIN = 42161
const ETH_CHAIN = 1

interface Quote {
  tool?: string
  estimate?: {
    toAmount?: string
    toAmountUSD?: string
    executionDuration?: number
    gasCosts?: { amountUSD?: string }[]
    feeCosts?: { amountUSD?: string }[]
  }
  action?: { toToken?: { decimals?: number; symbol?: string } }
  transactionRequest?: {
    to?: string
    data?: string
    value?: string
    gasLimit?: string
    chainId?: number
  }
}

async function quote(params: {
  fromAmountWei: bigint
  toToken: string
  toAddress: string
  fromAddress: string
}): Promise<Quote> {
  const url =
    `${LI_FI}/quote?fromChain=${ETH_CHAIN}&toChain=${ARB_CHAIN}` +
    `&fromToken=${ZERO}&toToken=${params.toToken}` +
    `&fromAmount=${params.fromAmountWei.toString()}` +
    `&fromAddress=${params.fromAddress}&toAddress=${params.toAddress}`
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) })
  if (!res.ok) throw new Error(`LI.FI quote failed (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as Quote
}

async function statusOf(txHash: string): Promise<string> {
  try {
    const res = await fetch(`${LI_FI}/status?txHash=${txHash}`, { signal: AbortSignal.timeout(20_000) })
    const body = (await res.json()) as { status?: string; substatus?: string }
    return `${body.status ?? "?"}${body.substatus ? `/${body.substatus}` : ""}`
  } catch {
    return "unknown"
  }
}

async function main() {
  const pk = process.env.FUNDING_WALLET_PRIVATE_KEY
  if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) throw new Error("FUNDING_WALLET_PRIVATE_KEY missing or malformed")
  const recipient = process.env.AGENT_TEST_WALLET_ADDRESS
  if (!recipient || !/^0x[a-fA-F0-9]{40}$/i.test(recipient)) throw new Error("AGENT_TEST_WALLET_ADDRESS missing")

  const wallet = new Wallet(pk)
  const provider = new JsonRpcProvider(ETHEREUM_RPC, undefined, { staticNetwork: true })
  const balance = await provider.getBalance(wallet.address)

  const usdcEth = Number(process.env.BRIDGE_USDC_ETH ?? "0.0072")
  const gasEth = Number(process.env.BRIDGE_GAS_ETH ?? "0.0006")
  const gasReserve = 0.0008 // two origin transactions at current mainnet gas

  console.log(`funding wallet : ${wallet.address}`)
  console.log(`test wallet    : ${recipient}`)
  console.log(`balance        : ${formatEther(balance)} ETH`)
  console.log(`plan           : ${usdcEth} ETH → USDC on Arbitrum`)
  console.log(`                 ${gasEth} ETH → ETH on Arbitrum (gas)`)
  console.log(`gas reserve    : ${gasReserve} ETH kept for the two origin txs`)

  const spendWei = BigInt(Math.round(usdcEth * 1e6)) * 10n ** 12n
  const gasWei = BigInt(Math.round(gasEth * 1e6)) * 10n ** 12n
  const reserveWei = BigInt(Math.round(gasReserve * 1e6)) * 10n ** 12n
  if (spendWei + gasWei + reserveWei > balance) {
    throw new Error("insufficient ETH: plan + gas reserve exceeds the balance")
  }

  // Quote both legs first, so the numbers are visible before anything is signed.
  const [qUsdc, qGas] = await Promise.all([
    quote({ fromAmountWei: spendWei, toToken: ARB_USDC, toAddress: recipient, fromAddress: wallet.address }),
    quote({ fromAmountWei: gasWei, toToken: ZERO, toAddress: recipient, fromAddress: wallet.address }),
  ])

  for (const [label, q] of [["USDC leg", qUsdc], ["gas leg", qGas]] as const) {
    const fees = [...(q.estimate?.feeCosts ?? []), ...(q.estimate?.gasCosts ?? [])]
      .map((f) => f.amountUSD)
      .filter(Boolean)
      .join(" + ")
    console.log(
      `\n[${label}] ${q.tool} → ${q.estimate?.toAmount} ${q.action?.toToken?.symbol ?? ""} ` +
        `($${q.estimate?.toAmountUSD ?? "?"}), fees+gas $${fees || "0"}`,
    )
    console.log(`  target contract: ${q.transactionRequest?.to}`)
  }

  if (process.env.CONFIRM_BRIDGE !== "1") {
    console.log("\nDRY RUN — nothing signed. Re-run with CONFIRM_BRIDGE=1 to execute.")
    return
  }

  for (const [label, q] of [["USDC leg", qUsdc], ["gas leg", qGas]] as const) {
    const tx = q.transactionRequest
    if (!tx?.to || tx.value === undefined) throw new Error(`${label}: quote has no transaction`)
    console.log(`\n[${label}] sending ${formatEther(BigInt(tx.value))} ETH to ${tx.to} …`)
    const sent = await wallet.connect(provider).sendTransaction({
      to: tx.to,
      data: tx.data,
      value: BigInt(tx.value),
      // 20% headroom: unused gas is refunded, but an under-estimate reverts
      gasLimit: tx.gasLimit ? (BigInt(tx.gasLimit) * 12n) / 10n : undefined,
    })
    console.log(`  tx: ${sent.hash}`)
    await sent.wait()
    console.log("  mined; waiting for the bridge to settle …")
    for (let i = 1; i <= 20; i++) {
      await new Promise((r) => setTimeout(r, 15_000))
      const st = await statusOf(sent.hash)
      console.log(`    ${i}: ${st}`)
      if (st.startsWith("DONE")) break
      if (st.startsWith("FAILED")) throw new Error(`${label} failed: ${st}`)
    }
  }

  console.log(`\n✅ done. Verify with a balance read of ${recipient} on Arbitrum.`)
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
