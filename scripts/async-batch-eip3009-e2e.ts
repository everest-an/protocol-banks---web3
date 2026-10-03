/**
 * Async (file-upload) batch payout E2E under EIP-3009, against a local dev server.
 *
 *   upload CSV → cron parses → approve signs one authorization per row →
 *   execute settles from the payer's own balance (relayer pays gas only).
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/async-batch-eip3009-e2e.ts
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
  init: { method?: string; body?: unknown; token?: string } = {},
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

async function login(pk: string): Promise<string> {
  const wallet = new Wallet(pk)
  const nonceRes = await fetch(`${BASE}/api/auth/siwe/nonce`)
  const { nonce } = (await nonceRes.json()) as { nonce: string }
  const message = buildSiweMessage({ domain: HOST, address: wallet.address, uri: BASE, nonce, chainId: CHAIN_ID })
  const signature = await wallet.signMessage(message)
  const verify = await api("/api/auth/siwe/verify", { method: "POST", body: { message, signature } })
  if (verify.status !== 200 || !verify.json.token) {
    throw new Error(`SIWE failed (${verify.status}): ${JSON.stringify(verify.json)}`)
  }
  return String(verify.json.token)
}

type PayerAccount = ReturnType<typeof privateKeyToAccount>

async function signRow(payer: PayerAccount, to: string, amount: string, index: number) {
  const authorization = createTransferAuthorization({ from: payer.address, to, amount, chainId: CHAIN_ID, tokenSymbol: "USDC" })
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
    index,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce,
    v: parseInt(signature.slice(130, 132), 16),
    r: signature.slice(0, 66),
    s: "0x" + signature.slice(66, 130),
  }
}

async function main() {
  const pk = process.env.AGENT_TEST_WALLET_PRIVATE_KEY
  const relayerPk = process.env.RELAYER_PRIVATE_KEY
  if (!pk || !relayerPk) throw new Error("AGENT_TEST_WALLET_PRIVATE_KEY / RELAYER_PRIVATE_KEY missing")
  const payer = privateKeyToAccount(pk as `0x${string}`)
  const relayer = new Wallet(relayerPk)

  const rpc = new JsonRpcProvider(RPC, undefined, { staticNetwork: true })
  const erc20 = new Contract(USDC, ["function balanceOf(address) view returns (uint256)"], rpc)
  const bal = async (address: string) => Number(formatUnits((await erc20.balanceOf(address)) as bigint, 6))

  const recipients = [Wallet.createRandom().address, Wallet.createRandom().address]
  const before = {
    payer: await bal(payer.address),
    relayer: await bal(relayer.address),
    recipients: await Promise.all(recipients.map(bal)),
  }
  console.log(`before — payer ${before.payer} · relayer ${before.relayer} · recipients ${before.recipients.join(" / ")}`)
  const total = Number(AMOUNT) * recipients.length
  if (before.payer < total) throw new Error(`payer holds ${before.payer} USDC, needs ${total}`)

  const token = await login(pk)

  // ── 1. Upload the CSV ────────────────────────────────────────────────────
  const csv = ["recipient,amount,token", ...recipients.map((address) => `${address},${AMOUNT},USDC`)].join("\n")
  const form = new FormData()
  form.append("file", new Blob([csv], { type: "text/csv" }), "batch-e2e.csv")
  const uploadRes = await fetch(`${BASE}/api/batch/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const uploadData = (await uploadRes.json().catch(() => ({}))) as Json
  check("upload CSV", uploadRes.status === 200 && typeof uploadData.jobId === "string", `http ${uploadRes.status}`)
  const jobId = String(uploadData.jobId)

  // ── 2. Trigger the parser (dev allows cron without a secret) ─────────────
  const cron = await fetch(`${BASE}/api/cron/process-batch`)
  check("parser ran", cron.status === 200, `http ${cron.status}`)

  let status = ""
  for (let i = 0; i < 20; i++) {
    const s = await api(`/api/batch/status?id=${jobId}`, { token })
    status = String(s.json.status ?? "")
    if (status === "PENDING_APPROVAL") break
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  check("job reached PENDING_APPROVAL", status === "PENDING_APPROVAL", `status=${status}`)

  // ── 3. Dry-run execute → rows to sign ────────────────────────────────────
  const prep = await api("/api/batch/execute", {
    method: "POST",
    token,
    body: { jobId, chain: "sepolia", chainId: CHAIN_ID },
  })
  const items = Array.isArray(prep.json.items) ? (prep.json.items as Array<{ index: number; recipient: string; amount: string }>) : []
  check("dry-run returns rows to sign", prep.status === 200 && items.length === 2, `http ${prep.status} items=${items.length}`)

  // ── 4. Sign one authorization per row, then execute ──────────────────────
  const authorizations = []
  for (const item of items) {
    authorizations.push(await signRow(payer, item.recipient, item.amount, item.index))
  }
  const executed = await api("/api/batch/execute", {
    method: "POST",
    token,
    body: { jobId, chain: "sepolia", chainId: CHAIN_ID, authorizations },
  })
  const execution = (executed.json.execution ?? {}) as Json
  check(
    "execute settles both rows via EIP-3009",
    executed.status === 200 && Number(execution.completed) === 2 && Number(execution.nonCustodial) === 2,
    `http ${executed.status} completed=${execution.completed} nonCustodial=${execution.nonCustodial}${
      executed.status !== 200 ? " " + String(executed.json.error ?? "") : ""
    }`,
  )

  const finalStatus = String(executed.json.status ?? "")
  check("job marked completed", finalStatus === "completed", `status=${finalStatus}`)

  // ── 5. Balances ──────────────────────────────────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, 9000))
  const after = {
    payer: await bal(payer.address),
    relayer: await bal(relayer.address),
    recipients: await Promise.all(recipients.map(bal)),
  }
  console.log(`after  — payer ${after.payer} · relayer ${after.relayer} · recipients ${after.recipients.join(" / ")}`)
  check("payer funded it", Math.abs(before.payer - after.payer - total) < 1e-9, `${before.payer} → ${after.payer}`)
  check("relayer untouched", Math.abs(after.relayer - before.relayer) < 1e-9, `${before.relayer} → ${after.relayer}`)
  check(
    "recipients paid",
    recipients.every((_, i) => Math.abs(after.recipients[i] - before.recipients[i] - Number(AMOUNT)) < 1e-9),
    after.recipients.join(" / "),
  )

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
