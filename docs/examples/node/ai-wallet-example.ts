/**
 * AI Wallet SDK — Complete Usage Example
 *
 * This example shows how an AI agent can autonomously:
 *   1. Create a wallet (using viem)
 *   2. Authenticate via SIWE (Sign-In with Ethereum)
 *   3. Make payments
 *   4. Create invoices to receive payments
 *   5. Manage session keys for automated operations
 *   6. Manage vendor contacts
 *
 * The AI agent's private key NEVER leaves the agent.
 * Protocol Banks only receives signed messages — never raw keys.
 *
 * Prerequisites:
 *   npm install viem
 */

import { AIWalletSDK } from '@/lib/ai-wallet'
import { privateKeyToAccount } from 'viem/accounts'

async function main() {
  // ─── Step 1: AI generates or loads its wallet ──────────────────────
  // The private key stays in the AI agent's secure environment.
  // In production, store this in a secure vault (e.g. AWS Secrets Manager).
  const account = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // Example only!
  )
  console.log('AI Wallet Address:', account.address)

  // ─── Step 2: Initialize the SDK ────────────────────────────────────
  const wallet = new AIWalletSDK({
    walletAddress: account.address,
    signMessage: (msg) => account.signMessage({ message: msg }),
    baseUrl: 'https://app.protocolbanks.com',
    chainId: 1, // Ethereum mainnet (used in SIWE message)
    onTokenRefresh: (token) => {
      console.log('JWT refreshed, new expiry in 1 hour')
    },
  })

  // ─── Step 3: Authenticate via SIWE ─────────────────────────────────
  // This performs the full Sign-In with Ethereum flow:
  //   1. Fetches a one-time nonce from the server
  //   2. Constructs an EIP-4361 SIWE message
  //   3. Signs the message locally (private key stays here)
  //   4. Sends the signature to the server for verification
  //   5. Receives a JWT (1h) + refresh token (30d)
  //   6. Auto-refreshes the JWT before expiry
  const session = await wallet.connectAndSignIn()
  console.log('Authenticated! Token expires at:', session.expiresAt)

  // ─── Step 4: Make a Payment ────────────────────────────────────────
  const payment = await wallet.payments.create({
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    amount: '100',
    token: 'USDC',
    chain: 'base',
    memo: 'AI Agent Service Fee - Invoice #1042',
  })
  console.log('Payment created:', payment.id, 'Status:', payment.status)

  // List recent payments
  const recentPayments = await wallet.payments.list({
    status: 'completed',
    limit: 10,
  })
  console.log('Recent completed payments:', recentPayments.length)

  // ─── Step 5: Create an Invoice (Receive Payments) ──────────────────
  const invoice = await wallet.invoices.create({
    amount: 250,
    token: 'USDC',
    recipient_address: account.address,
    description: 'AI Agent Consulting Fee',
    customer_email: 'client@example.com',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  })
  console.log('Invoice created:', invoice.invoice_id)
  console.log('Payment URL:', invoice.payment_url)

  // ─── Step 6: Create a Session Key ──────────────────────────────────
  // Session keys allow the AI to pre-authorize spending limits,
  // enabling fast automated payments without signing each one.
  const sessionKey = await wallet.sessionKeys.create({
    chainId: 8453, // Base
    spendingLimit: '10000000000', // 10,000 USDC (6 decimals)
    allowedTokens: ['USDC', 'USDT'],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
  })
  console.log('Session key created:', sessionKey.id)
  console.log('Spending limit:', sessionKey.spending_limit)

  // List active session keys
  const keys = await wallet.sessionKeys.list()
  console.log('Active session keys:', keys.filter(k => k.is_active).length)

  // ─── Step 7: Manage Vendors (Contacts) ─────────────────────────────
  const vendor = await wallet.vendors.create({
    name: 'Cloud Provider Inc.',
    wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
    category: 'Infrastructure',
    tags: ['cloud', 'monthly'],
  })
  console.log('Vendor created:', vendor.id, vendor.name)

  // ─── Step 8: x402 Machine-to-Machine Payment ──────────────────────
  // Use x402 protocol for instant micropayments between AI agents.
  const auth = await wallet.payments.createAuthorization({
    from: account.address,
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
    amount: '1000000', // 1 USDC
    token: 'USDC',
    chainId: 8453,
  })
  console.log('x402 authorization created, transferId:', auth.transferId)

  // ─── Step 9: Check Authentication Status ───────────────────────────
  console.log('Is authenticated:', wallet.isAuthenticated)

  // ─── Step 10: Disconnect ───────────────────────────────────────────
  wallet.disconnect()
  console.log('Disconnected. Is authenticated:', wallet.isAuthenticated)
}

main().catch(console.error)
