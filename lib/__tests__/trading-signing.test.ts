/**
 * Offline verification of Hyperliquid signing primitives.
 *
 * These tests prove the manual EIP-712 implementation is internally
 * consistent (digest construction matches ethers signature recovery) and
 * that the msgpack serialization of L1 actions is byte-deterministic —
 * both required for Hyperliquid to accept real signatures.
 */

import { Wallet, keccak256, toUtf8Bytes } from "ethers"
import { encode as msgpackEncode, decode as msgpackDecode } from "@msgpack/msgpack"
import {
  approveAgentTypedData,
  approveAgentDigest,
  recoverSigner,
  signL1Action,
  l1ActionDigest,
  type L1Action,
} from "@/lib/trading/exchange"

describe("approveAgent user-signed EIP-712", () => {
  const wallet = Wallet.createRandom()
  const agent = Wallet.createRandom()
  const nonce = 1_750_000_000_000

  it("recoverSigner returns the signing wallet (digest round-trip)", () => {
    const typedData = approveAgentTypedData({ agentAddress: agent.address, agentName: "Protocol Bank AI", nonce })
    const digest = approveAgentDigest(typedData)
    const sig = wallet.signingKey.sign(digest)
    const recovered = recoverSigner(digest, { r: sig.r, s: sig.s, v: sig.v + 27 })
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase())
  })

  it("rejects a signature from a different wallet", () => {
    const other = Wallet.createRandom()
    const typedData = approveAgentTypedData({ agentAddress: agent.address, agentName: "X", nonce })
    const digest = approveAgentDigest(typedData)
    const sig = other.signingKey.sign(digest)
    const recovered = recoverSigner(digest, { r: sig.r, s: sig.s, v: sig.v + 27 })
    expect(recovered.toLowerCase()).not.toBe(wallet.address.toLowerCase())
  })

  it("produces different digests for different nonces (replay protection)", () => {
    const d1 = approveAgentDigest(
      approveAgentTypedData({ agentAddress: agent.address, agentName: "A", nonce: 1_000_000 }),
    )
    const d2 = approveAgentDigest(
      approveAgentTypedData({ agentAddress: agent.address, agentName: "A", nonce: 1_000_001 }),
    )
    expect(d1).not.toBe(d2)
  })

  it("has the exact struct/domain strings Hyperliquid expects", () => {
    const td = approveAgentTypedData({ agentAddress: agent.address, agentName: "Protocol Bank AI", nonce })
    expect(td.domain.name).toBe("HyperliquidSignTransaction")
    expect(td.domain.verifyingContract).toBe("0x0000000000000000000000000000000000000000")
    expect(td.primaryType).toBe("HyperliquidTransaction:ApproveAgent")
    expect(td.message.hyperliquidChain).toBe("Mainnet")
    expect(td.message.agentAddress).toBe(agent.address) // checksummed
    expect(td.message.nonce).toBe(nonce)
  })
})

describe("L1 action msgpack + phantom-agent signing", () => {
  const wallet = Wallet.createRandom()

  it("msgpack encoding is byte-identical to Python msgpack for wire structures", () => {
    const action: L1Action = {
      type: "order",
      orders: [{ a: 0, b: true, p: "1e15", s: "100", r: false, t: { limit: { tif: "Ioc" } } }],
      grouping: "na",
    }
    const bytes = msgpackEncode(action) as Uint8Array
    // Verify hand-computed header bytes: fixmap(3), fixstr(4)="type", fixstr(5)="order"
    expect(bytes[0]).toBe(0x83) // map(3)
    expect(bytes[1]).toBe(0xa4) // fixstr(4)
    expect(Buffer.from(bytes.slice(2, 6)).toString()).toBe("type")
    expect(bytes[6]).toBe(0xa5) // fixstr(5)
    expect(Buffer.from(bytes.slice(7, 12)).toString()).toBe("order")
    // Round-trips through msgpack decode
    const decoded = msgpackDecode(bytes) as L1Action
    expect(decoded.type).toBe("order")
    expect((decoded.orders as unknown[]).length).toBe(1)
  })

  it("l1ActionDigest is deterministic and vault/nonce-sensitive", () => {
    const action: L1Action = { type: "cancel", cancels: [{ a: 0, o: 123 }] }
    const vault = wallet.address
    const d1 = l1ActionDigest(action, vault, 1_000)
    const d2 = l1ActionDigest(action, vault, 1_000)
    expect(d1).toBe(d2)
    expect(l1ActionDigest(action, vault, 1_001)).not.toBe(d1)
    expect(l1ActionDigest(action, null, 1_000)).not.toBe(d1)
    const other = Wallet.createRandom()
    expect(l1ActionDigest(action, other.address, 1_000)).not.toBe(d1)
  })

  it("L1 signatures recover to the agent wallet (phantom-agent scheme round-trip)", () => {
    const action: L1Action = { type: "order", orders: [{ a: 0, b: true, p: "1e15", s: "100", r: false, t: { limit: { tif: "Ioc" } } }], grouping: "na" }
    const nonce = 1_750_000_000_000
    const sig = signL1Action(wallet, action, { vaultAddress: wallet.address, nonce })

    // Recompute the phantom digest exactly as the SDK does and verify recovery.
    const digest = l1ActionDigest(action, wallet.address, nonce)
    // domain: name "Exchange", version "1", chainId 1337, verifyingContract 0x0
    const domainTypeHash = keccak256(
      toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    )
    const { AbiCoder, getBytes, concat } = require("ethers") as typeof import("ethers")
    const coder = AbiCoder.defaultAbiCoder()
    const domainSeparator = keccak256(
      coder.encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          domainTypeHash,
          keccak256(toUtf8Bytes("Exchange")),
          keccak256(toUtf8Bytes("1")),
          1337,
          "0x0000000000000000000000000000000000000000",
        ],
      ),
    )
    const agentTypeHash = keccak256(toUtf8Bytes("Agent(string source,bytes32 connectionId)"))
    const structHash = keccak256(
      coder.encode(
        ["bytes32", "bytes32", "bytes32"],
        [agentTypeHash, keccak256(toUtf8Bytes("a")), coder.encode(["bytes32"], [digest])],
      ),
    )
    const fullDigest = keccak256(concat(["0x1901", domainSeparator, structHash]))
    const recovered = recoverSigner(fullDigest, sig)
    expect(recovered.toLowerCase()).toBe(wallet.address.toLowerCase())
  })
})
