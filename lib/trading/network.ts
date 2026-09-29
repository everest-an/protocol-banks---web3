/**
 * Hyperliquid network configuration — the single source of truth for the
 * mainnet/testnet switch.
 *
 * Selected by `HYPERLIQUID_NETWORK` (server-side env var):
 *   - unset / "mainnet" → mainnet (production default)
 *   - "testnet"         → testnet (faucet funds, safe to run end to end)
 *   - anything else     → mainnet (fail safe: never silently point at testnet,
 *                         and never half-configure a real-money account)
 *
 * What actually differs between the two environments (verified against
 * hyperliquid-python-sdk `utils/signing.py`):
 *
 *   | field                | mainnet            | testnet            |
 *   |----------------------|--------------------|--------------------|
 *   | info / exchange host | api.hyperliquid.xyz| api.hyperliquid-testnet.xyz |
 *   | hyperliquidChain     | "Mainnet"          | "Testnet"          |
 *   | phantom-agent source | "a"                | "b"                |
 *
 * What does NOT differ:
 *   - `signatureChainId` is hard-coded to 0x66eee by the SDK for user-signed
 *     actions, for both networks — the SDK comment says so explicitly
 *     ("signatureChainId is the chain used by the wallet to sign and can be
 *     any chain. hyperliquidChain determines the environment and prevents
 *     replaying an action on a different chain.").
 *   - The EIP-712 domain chainId of user-signed actions is fixed at 421614.
 */

export type HyperliquidNetwork = "mainnet" | "testnet"

export interface HyperliquidNetworkConfig {
  network: HyperliquidNetwork
  /** Drives the phantom-agent `source` letter ("a" mainnet / "b" testnet). */
  isMainnet: boolean
  infoUrl: string
  exchangeUrl: string
  /** Value placed in user-signed actions; also part of the signed struct. */
  hyperliquidChain: "Mainnet" | "Testnet"
  /** SDK-fixed for user-signed actions; identical on both networks. */
  signatureChainId: string
}

const NETWORK_CONFIGS: Record<HyperliquidNetwork, HyperliquidNetworkConfig> = {
  mainnet: {
    network: "mainnet",
    isMainnet: true,
    infoUrl: "https://api.hyperliquid.xyz/info",
    exchangeUrl: "https://api.hyperliquid.xyz/exchange",
    hyperliquidChain: "Mainnet",
    signatureChainId: "0x66eee",
  },
  testnet: {
    network: "testnet",
    isMainnet: false,
    infoUrl: "https://api.hyperliquid-testnet.xyz/info",
    exchangeUrl: "https://api.hyperliquid-testnet.xyz/exchange",
    hyperliquidChain: "Testnet",
    signatureChainId: "0x66eee",
  },
}

/**
 * Read the configured network. Resolved per call (not at module load) so tests
 * and scripts can flip it at runtime.
 */
export function getHyperliquidNetwork(): HyperliquidNetwork {
  const raw = (process.env.HYPERLIQUID_NETWORK ?? "").trim().toLowerCase()
  return raw === "testnet" ? "testnet" : "mainnet"
}

export function getHyperliquidNetworkConfig(): HyperliquidNetworkConfig {
  return NETWORK_CONFIGS[getHyperliquidNetwork()]
}

/** True when the process is pointed at testnet (faucet funds, no real value). */
export function isTestnet(): boolean {
  return getHyperliquidNetwork() === "testnet"
}
