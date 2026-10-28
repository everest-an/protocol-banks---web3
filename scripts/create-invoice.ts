/**
 * Create a pilot/plan invoice and print the payable link.
 *
 *   pnpm invoice:create --to 0x… --amount 1000 --description "Builder plan, November"
 *
 *   --to           EVM (0x…), TRON (T…) or Solana (base58)  [required]
 *   --amount       USD amount                               [required]
 *   --description  what is being billed
 *   --token        default USDC
 *   --chain        default TRON for a TRON address, else Ethereum
 *   --hours        expiry, default 168 (7 days), clamped 1..720
 *   --merchant     merchant name, default "Protocol Banks"
 *
 * The payer opens the link and settles on-chain; the invoice id is the record.
 */
import { prisma } from "../lib/prisma"
import { generateInvoiceId, signInvoice } from "../lib/invoice/signing"

const EVM = /^0x[a-fA-F0-9]{40}$/
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

function fail(message: string): never {
  console.error(`FAIL ${message}`)
  process.exit(1)
}

async function main() {
  const to = (arg("to") ?? "").trim()
  const amount = Number(arg("amount"))
  const description = arg("description") ?? "Protocol Banks pilot"
  const token = (arg("token") ?? "USDC").trim().toUpperCase()
  const hours = Math.min(720, Math.max(1, Number(arg("hours") ?? 168)))
  const merchant = arg("merchant") ?? "Protocol Banks"

  if (!to) fail("--to is required")
  if (!EVM.test(to) && !TRON.test(to) && !SOLANA.test(to)) {
    fail("--to must be an EVM (0x…), TRON (T…) or Solana address")
  }
  if (!Number.isFinite(amount) || amount <= 0) fail("--amount must be a positive number")

  const chain = (arg("chain") ?? (TRON.test(to) ? "TRON" : "Ethereum")).trim()
  const invoiceId = generateInvoiceId()
  const expiresAt = new Date(Date.now() + hours * 3_600_000)
  const signature = signInvoice(`${invoiceId}|${to}|${amount}|${token}`)

  const invoice = await prisma.invoice.create({
    data: {
      invoice_id: invoiceId,
      recipient_address: to,
      amount,
      token,
      chain,
      description,
      merchant_name: merchant,
      status: "pending",
      signature,
      expires_at: expiresAt,
      metadata: { createdVia: "pilot-billing" },
    },
  })

  const configured = process.env.NEXT_PUBLIC_APP_URL
  const origin = (
    configured && /^https?:\/\//i.test(configured) ? configured : "https://protocolbanks.com"
  ).replace(/\/+$/, "")
  const paymentLink = signature
    ? `${origin}/pay?invoice=${invoiceId}&sig=${signature}`
    : `${origin}/pay?invoice=${invoiceId}`

  console.log(`invoice     ${invoice.invoice_id} (${invoice.status})`)
  console.log(`amount      ${amount.toLocaleString("en-US", { style: "currency", currency: "USD" })} ${token} on ${chain}`)
  console.log(`description ${description}`)
  console.log(`expires     ${expiresAt.toISOString()}`)
  console.log(`signed      ${signature ? "yes" : "no (PAYMENT_LINK_SECRET is not set)"}`)
  console.log(`\nlink        ${paymentLink}`)
  console.log(`\nSend the link. The payer settles on-chain; read it back with the same id+sig.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error("FAILED", error instanceof Error ? error.message : error)
    await prisma.$disconnect().catch(() => {})
    process.exit(1)
  })
