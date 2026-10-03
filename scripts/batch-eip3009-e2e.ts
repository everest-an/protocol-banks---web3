/**
 * Non-custodial batch payout E2E (EIP-3009), against a local dev server.
 *
 * Flow: SIWE login → create a 2-item Sepolia batch → prove bad authorizations
 * are rejected (wrong signer, missing coverage) → execute with wallet-signed
 * EIP-3009 authorizations → assert the payer's balance moved, the relayer's
 * did not, and both recipients were paid.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/batch-eip3009-e2e.ts
 */

import { Contract, JsonRpcProvider, Wallet, formatUnits } from "ethers"
import { getAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { buildSiweMessage } from "@/lib/auth/siwe"
import {
  buildTransferAuthorizationTypedData,
  createTransferAuthorization,
  getTokenAddress,
} from "@/lib/erc3009"

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const HOST = new URL(BASE).host
const CHAIN_ID = 11155111
const RPC = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"
const USDC = getTokenAddress(CHAIN_ID, "USDC")!
const AMOUNT = "0.05"

type Json = Record<string, unknown>

let passed = 0
let failed = 0

function check(name: string, ok: boolean, note = "") {
  if (ok) passed++
  else failed++
  console.log(`   ${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`)
}

async function api(
  path: string,
  init: { method?: string; body?: Json; token?: string } = {},
): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  })
  const json = (await res.json().catch(() => ({}))) as Json
  return { status: res.status, json }
}

/** SIWE login with the test wallet; returns a JWT. */
async function login(pk: string): Promise<string> {
  const wallet = new Wallet(pk)
  const nonceRes = await fetch(`${BASE}/api/auth/siwe/nonce`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  const message = buildSiweMessage({
    domain: HOST,
    address: wallet.address,
    uri: BASE,
    nonce,
    chainId: CHAIN_ID,
  })
  const signature = await wallet.signMessage(message)
  const verify = await api("/api/auth/siwe/verify", { method: "POST", body: { message, signature } })
  if (verify.status !== 200 || !verify.json.token) {
    throw new Error(`SIWE failed (${verify.status}): ${JSON.stringify(verify.json)}`)
  }
  return String(verify.json.token)
}

type PayerAccount = ReturnType<typeof privateKeyToAccount>

function splitSig(signature: `0x${string}`) {
  return {
    v: parseInt(signature.slice(130, 132), 16),
    r: signature.slice(0, 66),
    s: "0x" + signature.slice(66, 130),
  }
}

/** A wallet-signed EIP-3009 authorization — exactly what the browser would produce. */
async function signAuth(payer: PayerAccount, to: string, amount: string) {
  const authorization = createTransferAuthorization({
    from: payer.address,
    to,
    amount,
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
  return {
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce,
    ...splitSig(signature),
  }
}

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  const relayerPk = process.env.RELAYER_PRIVATE_KEY
  if (!pk || !relayerPk) {
    throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY / RELAYER_PRIVATE_KEY missing")
  }
  const payer = privateKeyToAccount(pk as `0x${string}`)
  const relayer = new Wallet(relayerPk)

  const rpc = new JsonRpcProvider(RPC, undefined, { staticNetwork: true })
  const erc20 = new Contract(USDC, ["function balanceOf(address) view returns (uint256)"], rpc)
  const bal = async (address: string) =>
    Number(formatUnits((await erc20.balanceOf(address)) as bigint, 6))

  const token = await login(pk)

  // Two fresh recipients so the assertions cannot be polluted by earlier runs.
  const recipients = [Wallet.createRandom().address, Wallet.createRandom().address]

  const before = {
    payer: await bal(payer.address),
    relayer: await bal(relayer.address),
    recipients: await Promise.all(recipients.map(bal)),
  }
  console.log(
    `before — payer ${before.payer} · relayer ${before.relayer} · recipients ${before.recipients.join(" / ")}`,
  )
  const total = Number(AMOUNT) * recipients.length
  if (before.payer < total) {
    throw new Error(`payer holds ${before.payer} USDC, needs ${total}`)
  }

  // ── 1. Create the batch ──────────────────────────────────────────────────
  const created = await api("/api/batch-payment", {
    method: "POST",
    token,
    body: {
      recipients: recipients.map((address) => ({ address, amount: AMOUNT, token: "USDC" })),
      fromAddress: payer.address,
      chain: "sepolia",
      chainId: CHAIN_ID,
      network_type: "EVM",
    },
  })
  check(
    "create batch (2 items, sepolia)",
    created.status === 200 && typeof created.json.batchId === "string",
    `http ${created.status}`,
  )
  const batchId = String(created.json.batchId)

  // ── 2. Wrong signer must be rejected ─────────────────────────────────────
  const stranger = privateKeyToAccount(Wallet.createRandom().privateKey as `0x${string}`)
  const wrong = await signAuth(stranger, recipients[0], AMOUNT)
  const wrongRes = await api("/api/batch-payment/execute", {
    method: "POST",
    token,
    body: { batchId, authorizations: [{ index: 0, ...wrong }] },
  })
  check(
    "reject wrong-signer authorization",
    wrongRes.status === 400,
    `http ${wrongRes.status} ${String(wrongRes.json.error ?? "").slice(0, 70)}`,
  )

  // ── 3. Missing coverage must be rejected ─────────────────────────────────
  const partial = await signAuth(payer, recipients[0], AMOUNT)
  const partialRes = await api("/api/batch-payment/execute", {
    method: "POST",
    token,
    body: { batchId, authorizations: [{ index: 0, ...partial }] },
  })
  check(
    "reject incomplete coverage",
    partialRes.status === 400,
    `http ${partialRes.status} ${String(partialRes.json.error ?? "").slice(0, 70)}`,
  )

  // ── 4. Execute non-custodially ───────────────────────────────────────────
  const auth0 = await signAuth(payer, recipients[0], AMOUNT)
  const auth1 = await signAuth(payer, recipients[1], AMOUNT)
  const executed = await api("/api/batch-payment/execute", {
    method: "POST",
    token,
    body: { batchId, authorizations: [{ index: 0, ...auth0 }, { index: 1, ...auth1 }] },
  })
  const execution = (executed.json.execution ?? {}) as Json
  const completed = Number(execution.completed ?? -1)
  const nonCustodial = Number(execution.nonCustodial ?? -1)
  check(
    "execute settles both items via EIP-3009",
    executed.status === 200 && completed === 2 && nonCustodial === 2,
    `http ${executed.status} completed=${completed} nonCustodial=${nonCustodial}${
      executed.status !== 200 ? " " + String(executed.json.error ?? "") : ""
    }`,
  )

  // ── 5. Balances: payer funded it, relayer only paid gas ──────────────────
  await new Promise((resolve) => setTimeout(resolve, 9000))
  const after = {
    payer: await bal(payer.address),
    relayer: await bal(relayer.address),
    recipients: await Promise.all(recipients.map(bal)),
  }
  console.log(
    `after  — payer ${after.payer} · relayer ${after.relayer} · recipients ${after.recipients.join(" / ")}`,
  )
  check(
    "payer balance decreased by 0.10",
    Math.abs(before.payer - after.payer - 0.1) < 1e-9,
    `${before.payer} → ${after.payer}`,
  )
  check(
    "relayer balance unchanged (non-custodial)",
    Math.abs(after.relayer - before.relayer) < 1e-9,
    `${before.relayer} → ${after.relayer}`,
  )
  check(
    "recipients received 0.05 each",
    recipients.every((_, i) => Math.abs(after.recipients[i] - before.recipients[i] - 0.05) < 1e-9),
    after.recipients.join(" / "),
  )

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
