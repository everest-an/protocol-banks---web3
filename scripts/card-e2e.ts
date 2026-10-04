/**
 * Card (virtual Visa via Yativo) acceptance test.
 *
 * Read-only by default — deposit address, platform balance, card list. Run it
 * after re-issuing credentials; it reports exactly what the provider answers.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/card-e2e.ts
 *
 * `--confirm` additionally creates and funds a card. That spends real money:
 * card creation debits the platform's Yativo USD wallet (minimum $3), and the
 * account must have an activated customer in YATIVO_CUSTOMER_ID.
 */
import { yativoClient } from "@/lib/services/yativo-client.service"

const CONFIRM = process.argv.includes("--confirm")
const CREATE_AMOUNT = Number(process.env.CARD_TEST_AMOUNT ?? 3)

let passed = 0
let failed = 0
const check = (name: string, ok: boolean, note = "") => {
  if (ok) passed++
  else failed++
  console.log(`${ok ? "✅" : "❌"} ${name}${note ? ` — ${note}` : ""}`)
}
const reason = (error: unknown) => String((error as Error)?.message ?? error).slice(0, 160)

async function main() {
  // 1. Deposit address — where the platform's USDC is sent to fund the card wallet
  try {
    const response = await yativoClient.getDepositAddress("USDC")
    check("deposit address", true, JSON.stringify(response).slice(0, 160))
  } catch (error) {
    check("deposit address", false, reason(error))
  }

  // 2. Platform wallet balance — cards are funded from it
  try {
    const balance = await yativoClient.getWalletBalance()
    check("platform wallet balance", true, JSON.stringify(balance).slice(0, 160))
  } catch (error) {
    check("platform wallet balance", false, reason(error))
  }

  // 3. Existing cards
  try {
    const cards = await yativoClient.listCards()
    check("list cards", true, JSON.stringify(cards).slice(0, 160))
  } catch (error) {
    check("list cards", false, reason(error))
  }

  // 4. Optional spend: create + fund a card
  if (CONFIRM && failed === 0) {
    if (!process.env.YATIVO_CUSTOMER_ID) {
      console.log("⚠️  YATIVO_CUSTOMER_ID not set — card creation needs an activated customer id")
    } else {
      try {
        const created = await yativoClient.createCard({
          customer_id: process.env.YATIVO_CUSTOMER_ID,
          amount: CREATE_AMOUNT,
          name_on_card: "Protocol Banks Acceptance Test",
        })
        const card = (created as { data?: { card_id?: string; last4?: string } }).data ?? {}
        check("create card", true, `card_id=${card.card_id ?? "?"} last4=${card.last4 ?? "?"}`)

        if (card.card_id) {
          const funded = await yativoClient.fundCard({ card_id: card.card_id, amount: 1 })
          check("fund card (+$1)", true, JSON.stringify(funded).slice(0, 120))
        }
      } catch (error) {
        check("create/fund card", false, reason(error))
      }
    }
  }

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES PRESENT"}: ${passed} passed, ${failed} failed`)
  if (!CONFIRM) console.log("(read-only run — pass --confirm to create and fund a card)")
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("FATAL", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
