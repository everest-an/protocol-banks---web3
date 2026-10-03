/**
 * Unit tests for server-side EIP-3009 batch authorization validation.
 *
 * Signing uses fixed Hardhat test keys (public, never funded) — the suite is
 * fully offline and locks the guarantees the batch execute endpoint relies on:
 * a signature must cover exactly the item it claims and belong to the batch
 * owner, and every pending item on an EIP-3009-capable chain must be covered.
 */

import { getAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { buildTransferAuthorizationTypedData, createTransferAuthorization } from "@/lib/erc3009"
import {
  validateAuthorizations,
  type AuthorizableItem,
  type SignedAuthorizationInput,
} from "@/lib/services/eip3009-authorization"

const CHAIN_ID = 11155111
// Hardhat accounts #1 and #2 — well-known test keys.
const payer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d")
const otherSigner = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a")
const RECIPIENT_A = "0x1111111111111111111111111111111111111111"
const RECIPIENT_B = "0x2222222222222222222222222222222222222222"

type Authorization = ReturnType<typeof createTransferAuthorization>
type Signature = { v: number; r: string; s: string }

async function sign(signer: typeof payer, authorization: Authorization): Promise<Signature> {
  const typed = buildTransferAuthorizationTypedData(CHAIN_ID, "USDC", authorization)
  const signature = await signer.signTypedData({
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
    v: parseInt(signature.slice(130, 132), 16),
    r: signature.slice(0, 66),
    s: "0x" + signature.slice(66, 130),
  }
}

async function authorize(signer: typeof payer, to: string, amount = "0.05") {
  const authorization = createTransferAuthorization({
    from: payer.address,
    to,
    amount,
    chainId: CHAIN_ID,
    tokenSymbol: "USDC",
  })
  return { authorization, signature: await sign(signer, authorization) }
}

function entry(index: number, authorization: Authorization, signature: Signature): SignedAuthorizationInput {
  return {
    index,
    validAfter: authorization.validAfter,
    validBefore: authorization.validBefore,
    nonce: authorization.nonce,
    ...signature,
  }
}

function item(overrides: Partial<AuthorizableItem> = {}): AuthorizableItem {
  return {
    index: 0,
    recipient: RECIPIENT_A,
    amount: { toString: () => "0.05" },
    token: "USDC",
    chain: "sepolia",
    status: "pending",
    chainId: CHAIN_ID,
    ...overrides,
  }
}

describe("validateAuthorizations (EIP-3009 batch)", () => {
  const caller = payer.address
  const batchFrom = payer.address

  test("accepts a well-formed authorization", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const result = await validateAuthorizations(caller, batchFrom, [item()], [entry(0, authorization, signature)])
    expect(result[0]).toEqual({
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      nonce: authorization.nonce,
      ...signature,
    })
  })

  test("normalises legacy v (0/1) to 27/28", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const legacy: Signature = { ...signature, v: signature.v - 27 }
    const result = await validateAuthorizations(caller, batchFrom, [item()], [entry(0, authorization, legacy)])
    expect(result[0].v).toBe(signature.v)
  })

  test("rejects an authorization signed by a different wallet", async () => {
    const { authorization, signature } = await authorize(otherSigner, RECIPIENT_A)
    await expect(
      validateAuthorizations(caller, batchFrom, [item()], [entry(0, authorization, signature)])
    ).rejects.toThrow(/not the batch owner/)
  })

  test("rejects a signature over a different amount", async () => {
    // Signed for 0.5 but the item says 0.05: the reconstructed digest differs,
    // so the recovered signer is an unrelated address and validation fails.
    const { authorization, signature } = await authorize(payer, RECIPIENT_A, "0.5")
    await expect(
      validateAuthorizations(caller, batchFrom, [item()], [entry(0, authorization, signature)])
    ).rejects.toThrow(/not the batch owner/)
  })

  test("rejects an expired authorization", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const expired = {
      ...entry(0, authorization, signature),
      validBefore: Math.floor(Date.now() / 1000) - 10,
    }
    await expect(
      validateAuthorizations(caller, batchFrom, [item()], [expired])
    ).rejects.toThrow(/expired/)
  })

  test("rejects an authorization that is not yet valid", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const future = {
      ...entry(0, authorization, signature),
      validAfter: Math.floor(Date.now() / 1000) + 600,
    }
    await expect(
      validateAuthorizations(caller, batchFrom, [item()], [future])
    ).rejects.toThrow(/not valid yet/)
  })

  test("rejects a duplicate item index", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const one = entry(0, authorization, signature)
    await expect(
      validateAuthorizations(caller, batchFrom, [item()], [one, one])
    ).rejects.toThrow(/Duplicate authorization/)
  })

  test("rejects an unknown item index", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    await expect(
      validateAuthorizations(caller, batchFrom, [item()], [entry(9, authorization, signature)])
    ).rejects.toThrow(/unknown item/)
  })

  test("requires coverage for every pending item", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const items = [item({ index: 0 }), item({ index: 1, recipient: RECIPIENT_B })]
    await expect(
      validateAuthorizations(caller, batchFrom, items, [entry(0, authorization, signature)])
    ).rejects.toThrow(/Missing authorization for item #1/)
  })

  test("ignores authorizations (even malformed ones) for already-processed items", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    const items = [
      item({ index: 0 }),
      item({ index: 1, recipient: RECIPIENT_B, status: "completed" }),
    ]
    const bogus = {
      index: 1,
      validAfter: 0,
      validBefore: Math.floor(Date.now() / 1000) + 3600,
      nonce: "0x" + "00".repeat(32),
      v: 27,
      r: "0x" + "11".repeat(32),
      s: "0x" + "22".repeat(32),
    }
    const result = await validateAuthorizations(caller, batchFrom, items, [
      entry(0, authorization, signature),
      bogus,
    ])
    expect(result[0]).toBeDefined()
    expect(result[1]).toBeUndefined()
  })

  test("rejects a token without EIP-3009 support", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    await expect(
      validateAuthorizations(caller, batchFrom, [item({ token: "USDT" })], [
        entry(0, authorization, signature),
      ])
    ).rejects.toThrow(/does not support EIP-3009/)
  })

  test("rejects an unsupported chain", async () => {
    const { authorization, signature } = await authorize(payer, RECIPIENT_A)
    await expect(
      validateAuthorizations(caller, batchFrom, [item({ chain: "tron", chainId: undefined })], [
        entry(0, authorization, signature),
      ])
    ).rejects.toThrow(/unsupported chain/)
  })
})
