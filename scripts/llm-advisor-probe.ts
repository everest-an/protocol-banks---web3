/**
 * Live probe for the BYO-LLM advisor: runs one request through the real
 * channel chain (platform OpenRouter default -> DeepSeek fallback) and prints
 * the proposal. No user key involved.
 *
 * Usage (Windows):
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/llm-advisor-probe.ts
 */
import { adviseOnSignal } from '../lib/trading/llm-advisor'

async function main() {
  const started = Date.now()
  const proposal = await adviseOnSignal('0x0000000000000000000000000000000000000001', {
    signal: {
      coin: 'BTC',
      side: 'long',
      score: 0.72,
      momentumZ: 1.8,
      funding: -0.00021,
      volumeUsd: 1_450_000_000,
      markPx: 86277,
    },
    equityUsd: 520.4,
    openPositions: ['ETH'],
  })
  console.log(`[llm-advisor-probe] took ${Date.now() - started}ms`)
  console.log('[llm-advisor-probe] proposal:', JSON.stringify(proposal, null, 2))
  console.log(
    proposal
      ? '[llm-advisor-probe] OK — the advisor pipeline answered through the platform channels'
      : '[llm-advisor-probe] null — gate closed or every channel unavailable (deterministic fallback applies)',
  )
}

void main()
