/**
 * Testnet end-to-end driver for the live trading path.
 *
 * Exercises everything in live mode that does not need funds, against a dev
 * server pointed at Hyperliquid testnet (HYPERLIQUID_NETWORK=testnet):
 *
 *   1. SIWE login with the agent test wallet (EIP-191 personal_sign)
 *   2. agent-wallet status → generate (server returns EIP-712 approveAgent typed data)
 *   3. sign the typed data with the wallet key — the server recovers the signer
 *      locally before doing anything on-chain
 *   4. submit approveAgent to Hyperliquid and confirm `approved: true`
 *
 * Usage:
 *   HYPERLIQUID_NETWORK=testnet npx tsx scripts/testnet-e2e.ts
 *
 * Options (env):
 *   E2E_BASE_URL   base URL of the running app      (default http://localhost:3000)
 *   ALLOW_MAINNET  set to 1 to allow a mainnet run  (refused otherwise)
 *
 * The wallet key is read from AGENT_TEST_WALLET_PRIVATE_KEY (.env.local);
 * it is never printed.
 */

import { Wallet } from "ethers"
import { buildSiweMessage } from "@/lib/auth/siwe"
import {
  approveAgentDigest,
  placeMarketOrder,
  getAssetContext,
  getUserState,
} from "@/lib/trading/exchange"
import { getAgentWallet, loadAgentKeyRecord } from "@/lib/trading/keys"
import { getHyperliquidNetworkConfig } from "@/lib/trading/network"

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const HOST = new URL(BASE).host

type Json = Record<string, unknown>

async function post(path: string, body: Json, token?: string): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as Json
  return { status: res.status, json }
}

function step(n: number, title: string) {
  console.log(`\n[${n}] ${title}`)
}

async function main() {
  const cfg = getHyperliquidNetworkConfig()
  console.log(`network   : ${cfg.network} (${cfg.infoUrl})`)
  console.log(`app       : ${BASE}`)

  if (cfg.isMainnet && process.env.ALLOW_MAINNET !== "1") {
    throw new Error("Refusing to run against MAINNET. Set ALLOW_MAINNET=1 if you really mean it.")
  }

  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
    throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY missing or malformed in the environment (.env.local)")
  }
  const wallet = new Wallet(pk)
  console.log(`wallet    : ${wallet.address}`)

  // 0. app reachable?
  step(0, "app reachable")
  const health = await fetch(`${BASE}/api/health`).catch(() => null)
  if (!health || !health.ok) throw new Error(`${BASE}/api/health did not answer — start the dev server first`)
  console.log(`   ok (HTTP ${health.status})`)

  // 1. SIWE
  step(1, "SIWE login")
  const nonceRes = await fetch(`${BASE}/api/auth/siwe/nonce`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  if (!nonce) throw new Error("no nonce returned")
  const message = buildSiweMessage({
    domain: HOST,
    address: wallet.address,
    uri: BASE,
    nonce,
    chainId: 421614, // testnet — informational only, the server does not pin it
  })
  const siweSig = await wallet.signMessage(message)
  const verify = await post("/api/auth/siwe/verify", { message, signature: siweSig })
  if (verify.status !== 200 || !verify.json.token) {
    throw new Error(`SIWE verify failed (HTTP ${verify.status}): ${JSON.stringify(verify.json)}`)
  }
  const token = String(verify.json.token)
  console.log(`   logged in as ${verify.json.address}`)

  // 2. agent wallet state
  step(2, "agent-wallet status")
  const status1 = await post("/api/trading/live/agent-wallet", { action: "status" }, token)
  console.log(`   ${JSON.stringify(status1.json)}`)

  // 3. generate (idempotent: skip when one already exists)
  step(3, "generate agent wallet")
  let agentAddress = (status1.json.live as Json | undefined)?.agentAddress as string | null | undefined
  let agentName: string | undefined
  let nonce2: number | undefined
  const alreadyApproved = ((status1.json.live as Json | undefined)?.approved ?? false) as boolean
  if (agentAddress && !alreadyApproved) {
    // A previous attempt generated a key but never got it approved (e.g. the
    // venue refused for lack of funds). The approval needs a fresh nonce, and
    // the API only hands one out at generate time — so clear and regenerate.
    console.log(`   exists but unapproved (${agentAddress}) — revoking to get a fresh nonce`)
    await post("/api/trading/live/agent-wallet", { action: "revoke" }, token)
    agentAddress = null
  }
  if (agentAddress) {
    console.log(`   exists and approved: ${agentAddress} — skipping generate`)
    agentName = ((status1.json.live as Json).agentName as string) ?? "Protocol Bank AI"
  } else {
    const gen = await post("/api/trading/live/agent-wallet", { action: "generate" }, token)
    if (gen.status !== 200) throw new Error(`generate failed (HTTP ${gen.status}): ${JSON.stringify(gen.json)}`)
    agentAddress = String(gen.json.agentAddress)
    agentName = String(gen.json.agentName)
    nonce2 = Number(gen.json.nonce)
    console.log(`   agent ${agentAddress} (nonce ${nonce2})`)
  }

  // 4. sign + submit approveAgent (skip when already approved)
  const live = status1.json.live as Json | undefined
  step(4, "sign and submit approveAgent")
  if (live?.approved) {
    console.log("   already approved — nothing to submit")
  } else {
    if (!agentAddress || !agentName || nonce2 === undefined) {
      throw new Error("cannot approve: missing generate output (agent already existed but is not approved)")
    }
    const typedData = {
      domain: { name: "HyperliquidSignTransaction", version: "1", chainId: 421614, verifyingContract: "0x0000000000000000000000000000000000000000" },
      types: {
        "HyperliquidTransaction:ApproveAgent": [
          { name: "hyperliquidChain", type: "string" },
          { name: "agentAddress", type: "address" },
          { name: "agentName", type: "string" },
          { name: "nonce", type: "uint64" },
        ],
      },
      primaryType: "HyperliquidTransaction:ApproveAgent",
      message: { hyperliquidChain: cfg.hyperliquidChain, agentAddress, agentName, nonce: nonce2 },
    }
    const digest = approveAgentDigest(typedData)
    const sig = wallet.signingKey.sign(digest)
    // ethers v6 already returns v as 27/28 — do NOT add 27 again (that yields
    // 54/55, which Hyperliquid recovers to some unrelated address).
    const approve = await post(
      "/api/trading/live/agent-wallet",
      {
        action: "approve",
        agentAddress,
        agentName,
        nonce: nonce2,
        signature: { r: sig.r, s: sig.s, v: sig.v },
      },
      token,
    )
    console.log(`   HTTP ${approve.status}: ${JSON.stringify(approve.json)}`)
    if (approve.status !== 200) {
      const msg = JSON.stringify(approve.json)
      if (/Must deposit before performing actions/i.test(msg)) {
        console.log("\n   The venue requires a funded account before it accepts ANY action —")
        console.log("   including an agent approval, on testnet as well. Fund this address once:")
        console.log(`     1. send USDC (Arbitrum) + a little ETH for gas to ${wallet.address}`)
        console.log("     2. DRY RUN:  npx tsx -r dotenv/config scripts/fund-hyperliquid.ts")
        console.log("     3. EXECUTE:  $env:CONFIRM_DEPOSIT='1'; npx tsx -r dotenv/config scripts/fund-hyperliquid.ts")
        console.log("     4. claim the testnet faucet (1000 mock USDC) at app.hyperliquid-testnet.xyz/drip,")
        console.log("        then re-run this script for the full order round-trip")
      } else {
        console.log("   -> approval rejected; nothing was left half-done on our side")
      }
      process.exitCode = 1
      return
    }
  }

  // 5. confirm
  step(5, "final status")
  const status2 = await post("/api/trading/live/agent-wallet", { action: "status" }, token)
  console.log(`   ${JSON.stringify(status2.json)}`)

  const approved = ((status2.json.live as Json | undefined)?.approved ?? false) as boolean
  const liveFinal = status2.json.live as Json | undefined

  // 6. read-only sanity: the wallet exists on the configured venue
  step(6, "venue read-back (clearinghouseState)")
  const state = await getUserState(wallet.address)
  const accountValue = Number(state?.marginSummary?.accountValue ?? 0)
  console.log(`   accountValue=${accountValue}`)

  if (accountValue <= 0) {
    console.log("\nNot funded — stopping before the order steps.")
    console.log("Fund this address (Arbitrum USDC -> Hyperliquid, min 5 USDC), then re-run:")
    console.log("  npx tsx -r dotenv/config scripts/fund-hyperliquid.ts   # then CONFIRM_DEPOSIT=1")
    console.log(`\nRESULT: ${approved ? "approveAgent accepted" : "approveAgent blocked (funds required by the venue)"}`)
    return
  }

  if (!approved || !liveFinal?.agentAddress) {
    console.log("\nFunded but the agent is not approved — re-run this script once the approval succeeds.")
    process.exitCode = 1
    return
  }

  // 7. the real thing: place an IOC order through the app's own live-order path
  step(7, "place an IOC order via the app's live path (placeMarketOrder)")
  const agentWallet = getAgentWallet(wallet.address)
  if (!agentWallet) throw new Error("agent key could not be decrypted from the local record")
  const record = loadAgentKeyRecord(wallet.address)
  console.log(`   agent key: ${agentWallet.address}${record?.approved ? " (approved)" : " (NOT approved)"}`)

  const coin = process.env.E2E_COIN ?? "BTC"
  const sizeUsd = Number(process.env.E2E_SIZE_USD ?? "11")
  const asset = await getAssetContext(coin)
  if (!asset) throw new Error(`coin ${coin} not found in the ${cfg.network} universe`)
  console.log(
    `   ${coin} index=${asset.index} szDecimals=${asset.szDecimals} mid=${asset.midPx} size=$${sizeUsd}`,
  )

  const openRes = await placeMarketOrder({
    agentWallet,
    vaultAddress: null,
    coin,
    isBuy: true,
    sizeUsd,
  })
  console.log(`   open : ${JSON.stringify(openRes)}`)

  await new Promise((r) => setTimeout(r, 4000))
  const afterOpen = await getUserState(wallet.address)
  const pos = afterOpen?.assetPositions?.find((p) => p.position.coin === coin)
  console.log(`   position: ${pos ? `${pos.position.szi} @ ${pos.position.entryPx}` : "none"}`)

  // 8. flatten it again (reduceOnly) and confirm the account is flat
  step(8, "close the position (reduceOnly) and verify flat")
  if (!pos) {
    console.log("   no position to close — order may have been rejected; see the response above")
    process.exitCode = 1
    return
  }
  const size = Math.abs(Number(pos.position.szi))
  const closeRes = await placeMarketOrder({
    agentWallet,
    vaultAddress: null,
    coin,
    isBuy: Number(pos.position.szi) < 0, // buy to close a short, sell to close a long
    sizeUsd: sizeUsd,
    sizeCoins: size, // exact position size — avoids leaving dust behind
    reduceOnly: true,
  })
  console.log(`   close: ${JSON.stringify(closeRes)}`)

  await new Promise((r) => setTimeout(r, 4000))
  const afterClose = await getUserState(wallet.address)
  const still = afterClose?.assetPositions?.find((p) => p.position.coin === coin && Number(p.position.szi) !== 0)
  console.log(`   flat: ${still ? `NO — still ${still.position.szi}` : "yes"}`)
  console.log(`   accountValue after round-trip: ${afterClose?.marginSummary?.accountValue ?? "n/a"}`)
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
