/**
 * Server-side validation for wallet-signed EIP-3009 batch authorizations.
 *
 * The batch execute endpoint accepts one authorization per item. Before any
 * payout is submitted, every authorization must provably cover exactly the
 * item it claims (recipient, amount, validity window) and be signed by the
 * batch owner. A malformed or missing authorization must never silently fall
 * back to the custodial relayer-funded path — removing that silent custody is
 * the whole point of this settlement mode.
 *
 * The caller resolves `chainId` per item from the executor's chain map so this
 * module stays free of execution-layer dependencies (easy to unit test).
 */

import { getAddress, parseUnits, recoverTypedDataAddress, serializeSignature } from "viem"
import { ERC3009_TYPES, getEIP712Domain, getTokenDecimals, isERC3009Supported } from "@/lib/erc3009"

/** A wallet-signed EIP-3009 authorization as submitted by the client. */
export interface SignedAuthorizationInput {
  index: number
  v: number
  r: string
  s: string
  nonce: string
  validAfter: number
  validBefore: number
}

/** An authorization after validation, ready for the payout executor. */
export interface ValidatedAuthorization {
  validAfter: number
  validBefore: number
  nonce: string
  v: number
  r: string
  s: string
}

/** The item fields an authorization is validated against. */
export interface AuthorizableItem {
  index: number
  recipient: string
  amount: { toString(): string }
  token: string
  chain: string
  status: string
  /** Resolved by the caller from the executor's chain map; undefined = unsupported. */
  chainId?: number
}

export async function validateAuthorizations(
  callerAddress: string,
  batchFrom: string,
  items: AuthorizableItem[],
  input: SignedAuthorizationInput[]
): Promise<Record<number, ValidatedAuthorization>> {
  const byIndex = new Map(items.map((item) => [item.index, item]))
  const seen = new Set<number>()
  const validated: Record<number, ValidatedAuthorization> = {}
  const now = Math.floor(Date.now() / 1000)
  const pending = items.filter((item) => item.status === "pending")

  for (const entry of input) {
    if (!entry || typeof entry.index !== "number") {
      throw new Error("Malformed authorization entry")
    }
    if (seen.has(entry.index)) {
      throw new Error(`Duplicate authorization for item #${entry.index}`)
    }

    const item = byIndex.get(entry.index)
    if (!item) {
      throw new Error(`Authorization references unknown item #${entry.index}`)
    }
    if (item.status !== "pending") {
      // Already processed in an earlier run — nothing to sign for, ignore.
      continue
    }
    seen.add(entry.index)

    const chainId = item.chainId
    if (chainId === undefined) {
      throw new Error(`Item #${entry.index}: unsupported chain "${item.chain}"`)
    }
    if (!isERC3009Supported(chainId, item.token)) {
      throw new Error(
        `Item #${entry.index}: ${item.token} does not support EIP-3009 on "${item.chain}"`
      )
    }

    const domain = getEIP712Domain(chainId, item.token)
    if (!domain) {
      throw new Error(`Item #${entry.index}: missing EIP-712 domain for ${item.token}`)
    }

    if (typeof entry.validBefore !== "number" || entry.validBefore <= now) {
      throw new Error(`Item #${entry.index}: authorization expired`)
    }
    if (typeof entry.validAfter !== "number" || entry.validAfter > now) {
      throw new Error(`Item #${entry.index}: authorization is not valid yet`)
    }
    if (
      typeof entry.r !== "string" ||
      typeof entry.s !== "string" ||
      typeof entry.nonce !== "string"
    ) {
      throw new Error(`Item #${entry.index}: malformed signature components`)
    }

    // Wallets emit v as either 0/1 or 27/28; normalise to the 27/28 form the
    // token contract expects.
    const v = entry.v < 27 ? entry.v + 27 : entry.v
    if (v !== 27 && v !== 28) {
      throw new Error(`Item #${entry.index}: invalid signature v (${entry.v})`)
    }

    const value = parseUnits(item.amount.toString(), getTokenDecimals(chainId, item.token))
    const signature = serializeSignature({
      r: entry.r as `0x${string}`,
      s: entry.s as `0x${string}`,
      v: BigInt(v),
    })

    const signer = await recoverTypedDataAddress({
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        // getAddress both validates the registry address and narrows the type
        // to viem's checksummed Address for the EIP-712 domain.
        verifyingContract: getAddress(domain.verifyingContract),
      },
      types: ERC3009_TYPES,
      primaryType: "TransferWithAuthorization",
      message: {
        from: batchFrom as `0x${string}`,
        to: item.recipient as `0x${string}`,
        value,
        validAfter: BigInt(entry.validAfter),
        validBefore: BigInt(entry.validBefore),
        nonce: entry.nonce as `0x${string}`,
      },
      signature,
    })

    if (signer.toLowerCase() !== callerAddress.toLowerCase()) {
      throw new Error(
        `Item #${entry.index}: authorization signed by ${signer}, not the batch owner`
      )
    }

    validated[entry.index] = {
      validAfter: entry.validAfter,
      validBefore: entry.validBefore,
      nonce: entry.nonce,
      v,
      r: entry.r,
      s: entry.s,
    }
  }

  // Coverage: on an EIP-3009-capable chain/token every pending item must carry
  // its own authorization, otherwise it would execute from the relayer's
  // custodial balance without the caller ever noticing.
  for (const item of pending) {
    if (item.chainId === undefined) continue // the worker fails it explicitly
    if (!isERC3009Supported(item.chainId, item.token)) continue // cannot be non-custodial
    if (!seen.has(item.index)) {
      throw new Error(`Missing authorization for item #${item.index} (${item.token} on ${item.chain})`)
    }
  }

  return validated
}
