/**
 * Yativo Crypto connectivity check.
 *
 * Verifies the API-key → Bearer token exchange and a real read call
 * (GET /accounts/get-accounts) against the configured platform.
 * Defaults to the live crypto API; set YATIVO_BASE_URL to the sandbox to test there.
 *
 * Usage (Windows):
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/yativo-connect.ts
 */
import { yativoClient } from '../lib/services/yativo-client.service'

async function main() {
  const base =
    process.env.YATIVO_BASE_URL ?? process.env.YATIVO_API_URL ?? '(default: live crypto API)'
  console.log(`[yativo-connect] base=${base}`)
  console.log(`[yativo-connect] key=${(process.env.YATIVO_API_KEY ?? '(unset)').slice(0, 14)}`)

  try {
    const accounts = await yativoClient.getAccounts()
    console.log('[yativo-connect] token exchange + get-accounts OK')
    console.log(JSON.stringify(accounts, null, 2).slice(0, 1500))
  } catch (error) {
    console.error(
      '[yativo-connect] FAILED:',
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = 1
  }
}

void main()
