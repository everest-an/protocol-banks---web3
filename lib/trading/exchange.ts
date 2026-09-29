/**
 * Hyperliquid exchange client — signed actions for LIVE trading.
 *
 * Signing schemes implemented here are byte-for-byte ported from the
 * official hyperliquid-python-sdk (utils/signing.py):
 *
 * 1. L1 actions (order, cancel, ...) — "phantom agent" EIP-712:
 *      digest = keccak(msgpack(action) ++ uint64be(nonce) ++ vault_bytes)
 *      typed data: domain { name:"Exchange", version:"1", chainId:1337,
 *      verifyingContract:0x0 }, primaryType "Agent",
 *      message { source:"a" (mainnet), connectionId:digest }
 *
 * 2. User-signed actions (approveAgent) — EIP-712:
 *      domain { name:"HyperliquidSignTransaction", version:"1",
 *      chainId:0x66eee, verifyingContract:0x0 },
 *      primaryType "HyperliquidTransaction:ApproveAgent",
 *      fields: hyperliquidChain, agentAddress, agentName, nonce
 *
 * EIP-712 hashing is done manually with ethers primitives so the ":" type
 * names work reliably (some typed-data encoders reject them).
 *
 * LIVE MODE ONLY. The paper engine never touches this file.
 */

import { Wallet, keccak256, toUtf8Bytes, AbiCoder, getBytes, concat, getAddress, Signature, recoverAddress } from "ethers"
import { encode as msgpackEncode } from "@msgpack/msgpack"
import { getHyperliquidNetworkConfig } from "./network"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
const USER_SIGNED_CHAIN_ID = 0x66eee // fixed by the SDK for user-signed actions (both networks)
const L1_DOMAIN_CHAIN_ID = 1337 // legacy chainId in the phantom-agent domain

const coder = AbiCoder.defaultAbiCoder()

// ---------------------------------------------------------------------------
// EIP-712 primitives (manual — no encoder library involved)
// ---------------------------------------------------------------------------

type Field = { name: string; type: string }

function encodeType(name: string, fields: Field[]): string {
  return `${name}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`
}

function eip712DomainSeparator(domainName: string, chainId: number): string {
  const typeHash = keccak256(
    toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
  )
  return keccak256(
    coder.encode(
      ["bytes32", "bytes32", "bytes32", "uint256", "address"],
      [typeHash, keccak256(toUtf8Bytes(domainName)), keccak256(toUtf8Bytes("1")), chainId, ZERO_ADDRESS],
    ),
  )
}

function eip712Digest(structTypeHash: string, domainSeparator: string, fieldHashes: string[]): string {
  const types = ["bytes32", ...fieldHashes.map(() => "bytes32")]
  const structHash = keccak256(coder.encode(types, [structTypeHash, ...fieldHashes]))
  return keccak256(concat(["0x1901", domainSeparator, structHash]))
}

/** Hash a single EIP-712 struct field to its bytes32 form. */
function hashField(type: string, value: unknown): string {
  switch (type) {
    case "string":
      return keccak256(toUtf8Bytes(String(value)))
    case "address":
      return coder.encode(["address"], [getAddress(String(value))])
    case "bytes32":
      return coder.encode(["bytes32"], [String(value)])
    case "uint64":
    case "uint256":
      return coder.encode([type], [value])
    default:
      throw new Error(`Unsupported EIP-712 field type: ${type}`)
  }
}

export interface SignedSignature {
  r: string
  s: string
  v: number
}

function signDigest(wallet: Wallet, digest: string): SignedSignature {
  const sig = Signature.from(wallet.signingKey.sign(digest))
  return { r: sig.r, s: sig.s, v: sig.v >= 27 ? sig.v : sig.v + 27 }
}

/** Recover the signer address of a digest — used to verify user signatures. */
export function recoverSigner(digest: string, signature: SignedSignature): string {
  const sig = Signature.from({ r: signature.r, s: signature.s, v: signature.v >= 27 ? signature.v - 27 : signature.v })
  return recoverAddress(digest, sig)
}

// ---------------------------------------------------------------------------
// 1. L1 actions (agent-signed: orders, cancels, ...)
// ---------------------------------------------------------------------------

export interface L1Action {
  type: string
  [key: string]: unknown
}

/** keccak(msgpack(action) ++ uint64be(nonce) ++ vault) — port of action_hash(). */
export function l1ActionDigest(action: L1Action, vaultAddress: string | null, nonce: number): string {
  const packed = msgpackEncode(action) as Uint8Array
  const nonceBytes = new Uint8Array(8)
  const dv = new DataView(nonceBytes.buffer)
  dv.setBigUint64(0, BigInt(nonce), false)
  let data: Uint8Array | string = concat([packed, nonceBytes])
  if (vaultAddress === null || vaultAddress === undefined) {
    data = concat([data, new Uint8Array([0x00])])
  } else {
    const addrBytes = getBytes(getAddress(vaultAddress))
    data = concat([data, new Uint8Array([0x01]), addrBytes])
  }
  return keccak256(data)
}

/** Sign an L1 action with the agent wallet. */
export function signL1Action(
  wallet: Wallet,
  action: L1Action,
  opts: { vaultAddress: string | null; nonce: number; isMainnet?: boolean },
): SignedSignature {
  const digest = l1ActionDigest(action, opts.vaultAddress, opts.nonce)
  const isMainnet = opts.isMainnet ?? getHyperliquidNetworkConfig().isMainnet

  // Phantom agent typed data (l1_payload)
  const agentFields: Field[] = [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ]
  const domainSeparator = eip712DomainSeparator("Exchange", L1_DOMAIN_CHAIN_ID)
  const structTypeHash = keccak256(toUtf8Bytes(encodeType("Agent", agentFields)))
  const digest2 = eip712Digest(structTypeHash, domainSeparator, [
    hashField("string", isMainnet ? "a" : "b"),
    hashField("bytes32", digest),
  ])
  return signDigest(wallet, digest2)
}

// ---------------------------------------------------------------------------
// 2. User-signed actions (approveAgent)
// ---------------------------------------------------------------------------

export interface ApproveAgentTypedData {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: string
  }
  types: Record<string, Field[]>
  primaryType: string
  message: Record<string, unknown>
}

/**
 * Build the EIP-712 typed data a user signs in their wallet (MetaMask)
 * to approve the platform's agent wallet.
 */
export function approveAgentTypedData(params: {
  agentAddress: string
  agentName: string
  nonce: number
}): ApproveAgentTypedData {
  const fields: Field[] = [
    { name: "hyperliquidChain", type: "string" },
    { name: "agentAddress", type: "address" },
    { name: "agentName", type: "string" },
    { name: "nonce", type: "uint64" },
  ]
  return {
    domain: {
      name: "HyperliquidSignTransaction",
      version: "1",
      chainId: USER_SIGNED_CHAIN_ID,
      verifyingContract: ZERO_ADDRESS,
    },
    types: {
      "HyperliquidTransaction:ApproveAgent": fields,
    },
    primaryType: "HyperliquidTransaction:ApproveAgent",
    message: {
      hyperliquidChain: getHyperliquidNetworkConfig().hyperliquidChain,
      agentAddress: getAddress(params.agentAddress),
      agentName: params.agentName,
      nonce: params.nonce,
    },
  }
}

/** Compute the digest of the approveAgent typed data (for local verification). */
export function approveAgentDigest(typedData: ApproveAgentTypedData): string {
  const fields = typedData.types[typedData.primaryType]
  const domainSeparator = eip712DomainSeparator(typedData.domain.name, Number(typedData.domain.chainId))
  const structTypeHash = keccak256(toUtf8Bytes(encodeType(typedData.primaryType, fields)))
  const fieldHashes = fields.map((f) => hashField(f.type, typedData.message[f.name]))
  return eip712Digest(structTypeHash, domainSeparator, fieldHashes)
}

// ---------------------------------------------------------------------------
// Submission
// ---------------------------------------------------------------------------

/** Submit a signed exchange request. */
export async function submitExchange(request: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(getHyperliquidNetworkConfig().exchangeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(15_000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(`Hyperliquid exchange error ${res.status}: ${JSON.stringify(body)}`)
  }
  return body
}

export async function submitApproveAgent(params: {
  userAddress: string
  agentAddress: string
  agentName: string
  nonce: number
  signature: SignedSignature
}): Promise<unknown> {
  return submitExchange({
    action: {
      type: "approveAgent",
      hyperliquidChain: getHyperliquidNetworkConfig().hyperliquidChain,
      signatureChainId: getHyperliquidNetworkConfig().signatureChainId,
      agentAddress: getAddress(params.agentAddress),
      agentName: params.agentName,
      nonce: params.nonce,
    },
    nonce: params.nonce,
    signature: params.signature,
    vaultAddress: null,
  })
}

// ---------------------------------------------------------------------------
// Order sizing rules (venue constraints)
// ---------------------------------------------------------------------------

/**
 * Hyperliquid price rules: no more than 5 significant figures and no more than
 * (6 - szDecimals) decimal places for perps.
 */
export function roundPriceToVenue(px: number, szDecimals: number): number {
  if (!Number.isFinite(px) || px <= 0) throw new Error(`invalid price: ${px}`)
  const maxDecimals = Math.max(0, 6 - szDecimals)
  const sigFigs = Number(px.toPrecision(5))
  const clamped = Number(sigFigs.toFixed(maxDecimals))
  // toFixed can nudge the value back above 5 significant figures; re-apply.
  return Number(clamped.toPrecision(5))
}

/** Order sizes are floored to the asset's szDecimals — never rounded up. */
export function floorSizeToVenue(sz: number, szDecimals: number): number {
  const factor = 10 ** szDecimals
  return Math.floor(sz * factor) / factor
}

/**
 * Aggressive IOC price: mid moved by `slippage` in the direction of the trade,
 * then venue-rounded. Mirrors hyperliquid-python-sdk `_slippage_price`
 * (market orders are just aggressive limit orders with tif=Ioc).
 */
export function aggressivePrice(mid: number, isBuy: boolean, slippage: number, szDecimals: number): number {
  const raw = isBuy ? mid * (1 + slippage) : mid * (1 - slippage)
  return roundPriceToVenue(raw, szDecimals)
}

export interface AssetContext {
  coin: string
  index: number
  szDecimals: number
  midPx: number
}

/** Universe index, size decimals and mid price for a perp — one info call. */
export async function getAssetContext(coin: string): Promise<AssetContext | null> {
  try {
    const res = await fetch(getHyperliquidNetworkConfig().infoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as [
      { universe?: { name: string; szDecimals: number }[] },
      { midPx?: string; markPx?: string }[],
    ]
    const universe = body?.[0]?.universe ?? []
    const index = universe.findIndex((a) => a.name === coin)
    if (index < 0) return null
    const ctx = body?.[1]?.[index]
    const midPx = Number(ctx?.midPx ?? ctx?.markPx ?? 0)
    if (!Number.isFinite(midPx) || midPx <= 0) return null
    return { coin, index, szDecimals: universe[index].szDecimals, midPx }
  } catch {
    return null
  }
}

/** Hyperliquid rejects orders below this notional value. */
export const MIN_ORDER_VALUE_USD = 10

/** Market IOC order (agent-signed), acting on the user's account. */
export async function placeMarketOrder(params: {
  agentWallet: Wallet
  /** Vault/subaccount the order acts for; null for a normal account. */
  vaultAddress: string | null
  coin: string
  isBuy: boolean
  /** Notional in USD, converted to coin size at the aggressive price. */
  sizeUsd: number
  reduceOnly?: boolean
  /** Defaults to 5%, matching the SDK's DEFAULT_SLIPPAGE. */
  slippage?: number
  /** Overrides the size in coins (used to close a precise position size). */
  sizeCoins?: number
}): Promise<unknown> {
  const meta = await getAssetContext(params.coin)
  if (!meta) throw new Error(`Unknown market "${params.coin}" on Hyperliquid`)

  const slippage = params.slippage ?? 0.05
  const px = aggressivePrice(meta.midPx, params.isBuy, slippage, meta.szDecimals)

  // Size is denominated in coins on the wire — dividing by the mid (not the
  // aggressive price) keeps the notional honest.
  const rawSize = params.sizeCoins ?? params.sizeUsd / meta.midPx
  const size = floorSizeToVenue(rawSize, meta.szDecimals)
  if (!(size > 0)) {
    throw new Error(
      `order size rounds to zero: $${params.sizeUsd} at ${meta.midPx} with szDecimals=${meta.szDecimals}`,
    )
  }
  if (!params.reduceOnly && params.sizeUsd < MIN_ORDER_VALUE_USD) {
    throw new Error(`order value $${params.sizeUsd} is below Hyperliquid's $${MIN_ORDER_VALUE_USD} minimum`)
  }

  const action: L1Action = {
    type: "order",
    orders: [
      {
        a: meta.index,
        b: params.isBuy,
        p: String(px),
        s: String(size),
        r: params.reduceOnly ?? false,
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
  }
  const nonce = Date.now()
  const signature = signL1Action(params.agentWallet, action, {
    vaultAddress: params.vaultAddress,
    nonce,
  })
  return submitExchange({
    action,
    nonce,
    signature,
    vaultAddress: params.vaultAddress ? params.vaultAddress.toLowerCase() : null,
  })
}

// ---------------------------------------------------------------------------
// Info queries (no keys required)
// ---------------------------------------------------------------------------

export interface UserState {
  marginSummary: { accountValue: string; totalMarginUsed: string; totalNtlPos: string; totalRawUsd: string }
  assetPositions: {
    position: { coin: string; szi: string; entryPx: string | null; positionValue: string; unrealizedPnl: string }
  }[]
}

export async function getUserState(address: string): Promise<UserState | null> {
  try {
    const res = await fetch(getHyperliquidNetworkConfig().infoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: address }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return (await res.json()) as UserState
  } catch {
    return null
  }
}

/** Map a coin name to its index in the Hyperliquid universe (needed for orders). */
export async function coinToIndex(coin: string): Promise<number | null> {
  try {
    const res = await fetch(getHyperliquidNetworkConfig().infoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "meta" }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const meta = (await res.json()) as { universe: { name: string }[] }
    const idx = meta.universe.findIndex((u) => u.name === coin)
    return idx >= 0 ? idx : null
  } catch {
    return null
  }
}
