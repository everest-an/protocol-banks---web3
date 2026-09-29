/**
 * Hyperliquid testnet faucet ("drip").
 *
 * The web app's `/drip` page does not sign anything — reading its own chunk
 * (`assets/Drip-*.js`) shows it simply POSTs `{ type: "claimDrip", user }` to
 * the testnet info endpoint. That means the 1,000 mock USDC can be claimed
 * straight from a script, with no browser wallet involved.
 *
 * The gate is on the venue's side and is not something we can work around:
 *
 *   "Cannot claim drip because user 0x… does not exist on mainnet."
 *
 * i.e. the address must have a Hyperliquid mainnet account first, which only a
 * (minimum 5 USDC) mainnet deposit creates. See scripts/fund-hyperliquid.ts.
 */

const TESTNET_INFO = "https://api.hyperliquid-testnet.xyz/info"

export interface DripResult {
  ok: boolean
  detail: string
}

/** Claim the testnet drip for `address`. Safe to call repeatedly. */
export async function claimTestnetDrip(address: string): Promise<DripResult> {
  try {
    const res = await fetch(TESTNET_INFO, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "claimDrip", user: address }),
      signal: AbortSignal.timeout(20_000),
    })
    const body: unknown = await res.json().catch(() => null)
    const text = typeof body === "string" ? body : JSON.stringify(body)
    // Success answers with the credited amounts; the gate answers with a
    // "Cannot claim drip because …" string.
    const ok = !/^Cannot claim drip/i.test(text) && !/"error"/i.test(text)
    return { ok, detail: text }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}
