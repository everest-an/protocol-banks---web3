/**
 * Hyperliquid network switch (mainnet / testnet).
 *
 * The values asserted here mirror hyperliquid-python-sdk `utils/signing.py`:
 *   - `construct_phantom_agent`: source "a" on mainnet, "b" on testnet
 *   - `sign_user_signed_action`: sets `signatureChainId = "0x66eee"` for BOTH
 *     networks and `hyperliquidChain = "Mainnet" | "Testnet"`
 *
 * A wrong switch here would sign mainnet actions for a testnet endpoint (or
 * worse, the reverse) — so the safe default matters as much as the values.
 */

import {
  getHyperliquidNetwork,
  getHyperliquidNetworkConfig,
  isTestnet,
} from "@/lib/trading/network"
import { approveAgentTypedData, approveAgentDigest, signL1Action, type L1Action } from "@/lib/trading/exchange"
import { Wallet } from "ethers"

const ORIGINAL = process.env.HYPERLIQUID_NETWORK

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.HYPERLIQUID_NETWORK
  else process.env.HYPERLIQUID_NETWORK = ORIGINAL
})

describe("hyperliquid network selection", () => {
  it("defaults to mainnet when the env var is unset", () => {
    delete process.env.HYPERLIQUID_NETWORK
    expect(getHyperliquidNetwork()).toBe("mainnet")
    expect(isTestnet()).toBe(false)
    expect(getHyperliquidNetworkConfig().isMainnet).toBe(true)
  })

  it("selects testnet on HYPERLIQUID_NETWORK=testnet (case/space tolerant)", () => {
    process.env.HYPERLIQUID_NETWORK = "  TestNet "
    expect(getHyperliquidNetwork()).toBe("testnet")
    expect(isTestnet()).toBe(true)
  })

  it("falls back to mainnet for unknown values instead of silently using testnet", () => {
    process.env.HYPERLIQUID_NETWORK = "staging"
    expect(getHyperliquidNetwork()).toBe("mainnet")
  })
})

describe("network endpoints", () => {
  it("mainnet points at api.hyperliquid.xyz", () => {
    delete process.env.HYPERLIQUID_NETWORK
    const cfg = getHyperliquidNetworkConfig()
    expect(cfg.infoUrl).toBe("https://api.hyperliquid.xyz/info")
    expect(cfg.exchangeUrl).toBe("https://api.hyperliquid.xyz/exchange")
    expect(cfg.hyperliquidChain).toBe("Mainnet")
  })

  it("testnet points at api.hyperliquid-testnet.xyz", () => {
    process.env.HYPERLIQUID_NETWORK = "testnet"
    const cfg = getHyperliquidNetworkConfig()
    expect(cfg.infoUrl).toBe("https://api.hyperliquid-testnet.xyz/info")
    expect(cfg.exchangeUrl).toBe("https://api.hyperliquid-testnet.xyz/exchange")
    expect(cfg.hyperliquidChain).toBe("Testnet")
    expect(cfg.isMainnet).toBe(false)
  })

  it("keeps signatureChainId at the SDK-fixed 0x66eee on both networks", () => {
    delete process.env.HYPERLIQUID_NETWORK
    const mainnet = getHyperliquidNetworkConfig().signatureChainId
    process.env.HYPERLIQUID_NETWORK = "testnet"
    const testnet = getHyperliquidNetworkConfig().signatureChainId
    expect(mainnet).toBe("0x66eee")
    expect(testnet).toBe("0x66eee")
  })
})

describe("signing follows the configured network", () => {
  const agent = Wallet.createRandom()
  const nonce = 1_750_000_000_000

  it("approveAgent signs hyperliquidChain=Mainnet by default", () => {
    delete process.env.HYPERLIQUID_NETWORK
    const typed = approveAgentTypedData({ agentAddress: agent.address, agentName: "Protocol Bank AI", nonce })
    expect(typed.message.hyperliquidChain).toBe("Mainnet")
    // The EIP-712 domain chainId is fixed at 421614 on both networks.
    expect(Number(typed.domain.chainId)).toBe(421614)
  })

  it("approveAgent signs hyperliquidChain=Testnet on testnet", () => {
    process.env.HYPERLIQUID_NETWORK = "testnet"
    const typed = approveAgentTypedData({ agentAddress: agent.address, agentName: "Protocol Bank AI", nonce })
    expect(typed.message.hyperliquidChain).toBe("Testnet")
    expect(Number(typed.domain.chainId)).toBe(421614)
  })

  it("produces a different approveAgent digest per network (replay protection)", () => {
    const params = { agentAddress: agent.address, agentName: "Protocol Bank AI", nonce }
    delete process.env.HYPERLIQUID_NETWORK
    const mainnetDigest = approveAgentDigest(approveAgentTypedData(params))
    process.env.HYPERLIQUID_NETWORK = "testnet"
    const testnetDigest = approveAgentDigest(approveAgentTypedData(params))
    expect(mainnetDigest).not.toBe(testnetDigest)
  })

  it("L1 actions carry the network-specific phantom-agent source", () => {
    // The source field is hashed into the digest, so an explicit override is
    // the only way to compare the two networks from one process.
    const wallet = Wallet.createRandom()
    const action: L1Action = { type: "cancel", cancels: [] }
    delete process.env.HYPERLIQUID_NETWORK
    const mainnetSig = signL1Action(wallet, action, { vaultAddress: null, nonce })
    const testnetSig = signL1Action(wallet, action, { vaultAddress: null, nonce, isMainnet: false })
    expect(mainnetSig.r).not.toBe(testnetSig.r)
  })
})
