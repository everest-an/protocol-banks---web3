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
import { approveAgentDigest } from "@/lib/trading/exchange"
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
  if (agentAddress) {
    console.log(`   exists: ${agentAddress} — skipping generate`)
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
      console.log("   -> approval rejected; nothing was left half-done on our side")
      process.exitCode = 1
      return
    }
  }

  // 5. confirm
  step(5, "final status")
  const status2 = await post("/api/trading/live/agent-wallet", { action: "status" }, token)
  console.log(`   ${JSON.stringify(status2.json)}`)

  // 6. read-only sanity: the wallet exists on the configured venue
  step(6, "venue read-back (getUserState)")
  const stateRes = await fetch(`${cfg.infoUrl}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clearinghouseState", user: wallet.address }),
    signal: AbortSignal.timeout(10_000),
  })
  const state = (await stateRes.json().catch(() => null)) as Json | null
  const margin = state?.marginSummary as Json | undefined
  console.log(`   accountValue=${margin?.accountValue ?? "n/a"} (0 = not funded yet, expected)`)

  const approved = ((status2.json.live as Json | undefined)?.approved ?? false) as boolean
  console.log(`\nRESULT: ${approved ? "✅ approveAgent accepted by Hyperliquid" : "⚠️  not approved"}`)
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
