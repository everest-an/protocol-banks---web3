/**
 * Protocol Banks - Node.js Usage Examples
 *
 * Run with: npx tsx example-usage.ts
 */

import { ProtocolBanks, ProtocolBanksError } from './protocol-banks-sdk'

const WALLET = process.env.PB_WALLET || '0xYourWalletAddress'
const BASE_URL = process.env.PB_BASE_URL || 'http://localhost:3000/api'

const pb = new ProtocolBanks({
  walletAddress: WALLET,
  baseUrl: BASE_URL,
})

// ─── Example 1: Health Check ─────────────────────────────────────────

async function checkHealth() {
  const health = await pb.health()
  console.log('Health:', health)
}

// ─── Example 2: Create an Invoice ────────────────────────────────────

async function createInvoice() {
  const result = await pb.invoices.create({
    amount: 50.0,
    token: 'USDC',
    recipient_address: WALLET,
    description: 'Order #9876',
    customer_email: 'buyer@example.com',
    expires_at: '2026-04-01T00:00:00Z',
  })

  console.log('Invoice created:', result.data)
  return result.data
}

// ─── Example 3: List Payments with Filters ───────────────────────────

async function listPayments() {
  const result = await pb.payments.list({
    status: 'completed',
    network_type: 'EVM',
    limit: 10,
  })

  console.log(`Found ${result.data.length} payments`)
  for (const p of result.data) {
    console.log(`  ${p.tx_hash} — ${p.amount} ${p.token} on ${p.chain}`)
  }
}

// ─── Example 4: Verify a Payment ─────────────────────────────────────

async function verifyPayment(txHash: string, orderId: string) {
  const result = await pb.payments.verify({
    txHash,
    orderId,
    amount: '50.00',
  })

  if (result.data.valid) {
    console.log('Payment is valid!')
  } else {
    console.log('Payment invalid:', result.data.reason)
  }
}

// ─── Example 5: Create a Multi-Network Vendor ────────────────────────

async function createVendor() {
  const result = await pb.vendors.createMultiNetwork({
    name: 'Acme Global Supplier',
    addresses: [
      {
        network: 'ethereum',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        label: 'Main ETH wallet',
        isPrimary: true,
      },
      {
        network: 'tron',
        address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
        label: 'TRON settlement',
      },
    ],
  })

  console.log('Vendor created:', result.data)
}

// ─── Example 6: Set Up a Webhook ─────────────────────────────────────

async function setupWebhook() {
  const result = await pb.webhooks.create({
    name: 'My Server',
    url: 'https://my-server.com/webhooks/pb',
    events: ['payment.completed', 'payment.failed', 'invoice.paid'],
  })

  console.log('Webhook created:', result.data)
}

// ─── Example 7: Yield — Cross-Network Summary ───────────────────────

async function checkYield() {
  // Get best recommendation
  const rec = await pb.yield.recommendation()
  console.log(
    `Best yield: ${rec.data.recommendation.apy}% APY on ${rec.data.recommendation.network} (${rec.data.recommendation.protocol})`
  )

  // Get cross-network summary for a merchant
  const summary = await pb.yield.summary(WALLET)
  console.log(`Total balance: $${summary.data.totalBalance}`)
  console.log(`Total interest: $${summary.data.totalInterest}`)
  console.log(`Average APY: ${summary.data.averageAPY}%`)
}

// ─── Example 8: Analytics ────────────────────────────────────────────

async function getAnalytics() {
  const [summaryRes, monthlyRes, chainRes] = await Promise.all([
    pb.analytics.summary(),
    pb.analytics.monthly(),
    pb.analytics.byChain(),
  ])

  console.log('Analytics summary:', summaryRes.data)
  console.log('Monthly data:', monthlyRes.data)
  console.log('By chain:', chainRes.data)
}

// ─── Example 9: Error Handling ───────────────────────────────────────

async function errorHandlingExample() {
  try {
    await pb.payments.verify({
      txHash: 'invalid',
      orderId: 'test',
      amount: '10',
    })
  } catch (err) {
    if (err instanceof ProtocolBanksError) {
      console.error(`API Error (${err.status}): ${err.message}`)
      // err.status — HTTP status code (400, 401, 404, 429, 500…)
      // err.body   — full JSON response from the server

      if (err.status === 429) {
        console.error('Rate limited — retry later')
      }
    } else {
      throw err
    }
  }
}

// ─── Example 10: Webhook Signature Verification (Express) ────────────

/*
import crypto from 'crypto'
import express from 'express'

const app = express()
app.use(express.json())

const WEBHOOK_SECRET = process.env.PB_WEBHOOK_SECRET!

app.post('/webhooks/pb', (req, res) => {
  const signature = req.headers['x-pb-signature'] as string
  const timestamp  = req.headers['x-pb-timestamp'] as string

  // Verify signature
  const payload = `${timestamp}.${JSON.stringify(req.body)}`
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  // Reject old events (> 5 minutes)
  const age = Date.now() - parseInt(timestamp)
  if (age > 5 * 60 * 1000) {
    return res.status(400).json({ error: 'Stale event' })
  }

  // Process event
  const { event, data } = req.body
  switch (event) {
    case 'payment.completed':
      console.log('Payment received:', data.tx_hash, data.amount, data.token)
      break
    case 'invoice.paid':
      console.log('Invoice paid:', data.invoice_id)
      break
  }

  res.json({ received: true })
})

app.listen(4000, () => console.log('Webhook server on :4000'))
*/

// ─── Run All Examples ────────────────────────────────────────────────

async function main() {
  console.log('=== Protocol Banks SDK Examples ===\n')

  await checkHealth()
  console.log()

  // Uncomment examples to run:
  // await createInvoice()
  // await listPayments()
  // await verifyPayment('0xabc...', 'order_123')
  // await createVendor()
  // await setupWebhook()
  // await checkYield()
  // await getAnalytics()
  // await errorHandlingExample()
}

main().catch(console.error)
