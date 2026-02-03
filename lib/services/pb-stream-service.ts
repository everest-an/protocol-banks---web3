/**
 * PB-Stream Service (HTTP 402 Micropayment Gateway)
 *
 * Implements the L3 Communication Layer:
 * - HTTP 402 Payment Required responses
 * - State channel off-chain accounting
 * - Micropayment accumulation and batch settlement
 * - AI Agent payment validation
 *
 * Based on x402 Protocol (ERC-3009 TransferWithAuthorization)
 */

import { createClient } from "@/lib/supabase/server"

// ============================================================================
// Types
// ============================================================================

export interface PaymentChannel {
  id: string
  providerId: string // API service provider
  consumerId: string // AI Agent or user
  consumerAddress: string
  sessionKeyPublicKey?: string
  // Balance tracking
  depositAmount: string // Initial deposit
  spentAmount: string // Total spent
  pendingAmount: string // Accumulated but not settled
  // Settlement config
  settlementThreshold: string // Settle when pending reaches this
  autoSettleInterval: number // Auto-settle interval in seconds
  // Status
  status: ChannelStatus
  lastSettlementAt?: Date
  expiresAt: Date
  createdAt: Date
}

export type ChannelStatus = "open" | "settling" | "closed" | "expired"

export interface MicropaymentRequest {
  channelId: string
  amount: string
  resource: string // API endpoint or resource ID
  metadata?: Record<string, unknown>
}

export interface MicropaymentResult {
  success: boolean
  paymentId?: string
  remainingBalance?: string
  error?: string
  requiresSettlement?: boolean
}

export interface PaymentRequiredResponse {
  status: 402
  paymentRequired: true
  channelId?: string
  amount: string
  currency: string
  recipient: string
  paymentEndpoint: string
  acceptedMethods: string[]
  message: string
}

export interface SettlementResult {
  success: boolean
  settlementId?: string
  settledAmount?: string
  transactionHash?: string
  error?: string
}

export interface ChannelPayment {
  id: string
  channelId: string
  amount: string
  resource: string
  status: "pending" | "accumulated" | "settled" | "failed"
  settledInBatch?: string
  createdAt: Date
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_SETTLEMENT_THRESHOLD = "10" // $10 default
const DEFAULT_AUTO_SETTLE_INTERVAL = 3600 // 1 hour
const MIN_PAYMENT_AMOUNT = "0.0001" // Minimum micropayment

// ============================================================================
// Utility Functions
// ============================================================================

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

// ============================================================================
// Payment Channel Management
// ============================================================================

/**
 * Open a new payment channel
 */
export async function openPaymentChannel(params: {
  providerId: string
  consumerId: string
  consumerAddress: string
  depositAmount: string
  sessionKeyPublicKey?: string
  settlementThreshold?: string
  autoSettleInterval?: number
  durationSeconds?: number
}): Promise<PaymentChannel> {
  const supabase = await createClient()

  const id = `ch_${generateRandomHex(16)}`
  const now = new Date()
  const expiresAt = new Date(now.getTime() + (params.durationSeconds || 30 * 24 * 3600) * 1000)

  const channel: PaymentChannel = {
    id,
    providerId: params.providerId,
    consumerId: params.consumerId,
    consumerAddress: params.consumerAddress,
    sessionKeyPublicKey: params.sessionKeyPublicKey,
    depositAmount: params.depositAmount,
    spentAmount: "0",
    pendingAmount: "0",
    settlementThreshold: params.settlementThreshold || DEFAULT_SETTLEMENT_THRESHOLD,
    autoSettleInterval: params.autoSettleInterval || DEFAULT_AUTO_SETTLE_INTERVAL,
    status: "open",
    expiresAt,
    createdAt: now,
  }

  const { error } = await supabase.from("payment_channels").insert({
    id: channel.id,
    provider_id: channel.providerId,
    consumer_id: channel.consumerId,
    consumer_address: channel.consumerAddress,
    session_key_public_key: channel.sessionKeyPublicKey,
    deposit_amount: channel.depositAmount,
    spent_amount: channel.spentAmount,
    pending_amount: channel.pendingAmount,
    settlement_threshold: channel.settlementThreshold,
    auto_settle_interval: channel.autoSettleInterval,
    status: channel.status,
    expires_at: channel.expiresAt.toISOString(),
    created_at: channel.createdAt.toISOString(),
  })

  if (error) {
    throw new Error(`Failed to open payment channel: ${error.message}`)
  }

  return channel
}

/**
 * Get payment channel by ID
 */
export async function getPaymentChannel(channelId: string): Promise<PaymentChannel | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("payment_channels")
    .select("*")
    .eq("id", channelId)
    .single()

  if (error || !data) return null

  return mapDbToChannel(data)
}

/**
 * Close a payment channel (settle remaining and close)
 */
export async function closePaymentChannel(channelId: string, consumerId: string): Promise<SettlementResult> {
  const supabase = await createClient()

  const channel = await getPaymentChannel(channelId)
  if (!channel) {
    return { success: false, error: "Channel not found" }
  }

  if (channel.consumerId !== consumerId) {
    return { success: false, error: "Unauthorized" }
  }

  // Settle any pending amount first
  if (parseFloat(channel.pendingAmount) > 0) {
    await settleChannel(channelId)
  }

  // Close channel
  await supabase
    .from("payment_channels")
    .update({
      status: "closed",
      closed_at: new Date().toISOString(),
    })
    .eq("id", channelId)

  return { success: true, settledAmount: channel.pendingAmount }
}

// ============================================================================
// Micropayment Processing
// ============================================================================

/**
 * Process a micropayment request
 * This is the core function called by the HTTP 402 middleware
 */
export async function processMicropayment(request: MicropaymentRequest): Promise<MicropaymentResult> {
  const supabase = await createClient()

  // Get channel
  const channel = await getPaymentChannel(request.channelId)
  if (!channel) {
    return { success: false, error: "Payment channel not found" }
  }

  // Check channel status
  if (channel.status !== "open") {
    return { success: false, error: `Channel is ${channel.status}` }
  }

  // Check expiration
  if (new Date() > channel.expiresAt) {
    await supabase.from("payment_channels").update({ status: "expired" }).eq("id", channel.id)
    return { success: false, error: "Channel has expired" }
  }

  // Validate amount
  const amount = parseFloat(request.amount)
  if (isNaN(amount) || amount < parseFloat(MIN_PAYMENT_AMOUNT)) {
    return { success: false, error: `Minimum payment is ${MIN_PAYMENT_AMOUNT}` }
  }

  // Check available balance
  const deposit = parseFloat(channel.depositAmount)
  const spent = parseFloat(channel.spentAmount)
  const pending = parseFloat(channel.pendingAmount)
  const available = deposit - spent - pending

  if (amount > available) {
    return {
      success: false,
      error: "Insufficient channel balance",
      remainingBalance: available.toString(),
    }
  }

  // Record payment
  const paymentId = `mp_${generateRandomHex(16)}`
  const newPending = pending + amount

  await supabase.from("channel_payments").insert({
    id: paymentId,
    channel_id: channel.id,
    amount: request.amount,
    resource: request.resource,
    metadata: request.metadata ? JSON.stringify(request.metadata) : null,
    status: "accumulated",
    created_at: new Date().toISOString(),
  })

  // Update channel pending amount
  await supabase
    .from("payment_channels")
    .update({
      pending_amount: newPending.toString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", channel.id)

  // Check if settlement threshold reached
  const requiresSettlement = newPending >= parseFloat(channel.settlementThreshold)

  // Auto-settle if threshold reached
  if (requiresSettlement) {
    // Schedule immediate settlement (async)
    scheduleSettlement(channel.id)
  }

  return {
    success: true,
    paymentId,
    remainingBalance: (available - amount).toString(),
    requiresSettlement,
  }
}

/**
 * Generate HTTP 402 Payment Required response
 */
export function generatePaymentRequiredResponse(params: {
  amount: string
  currency?: string
  recipient: string
  channelId?: string
  message?: string
}): PaymentRequiredResponse {
  return {
    status: 402,
    paymentRequired: true,
    channelId: params.channelId,
    amount: params.amount,
    currency: params.currency || "USDC",
    recipient: params.recipient,
    paymentEndpoint: "/api/pb-stream/pay",
    acceptedMethods: ["session_key", "x402_authorization", "direct_transfer"],
    message: params.message || `Payment of ${params.amount} ${params.currency || "USDC"} required`,
  }
}

// ============================================================================
// Settlement
// ============================================================================

/**
 * Settle accumulated payments on-chain
 */
export async function settleChannel(channelId: string): Promise<SettlementResult> {
  const supabase = await createClient()

  const channel = await getPaymentChannel(channelId)
  if (!channel) {
    return { success: false, error: "Channel not found" }
  }

  const pendingAmount = parseFloat(channel.pendingAmount)
  if (pendingAmount <= 0) {
    return { success: true, settledAmount: "0" }
  }

  // Mark channel as settling
  await supabase
    .from("payment_channels")
    .update({ status: "settling" })
    .eq("id", channelId)

  try {
    // Create settlement record
    const settlementId = `stl_${generateRandomHex(16)}`

    await supabase.from("channel_settlements").insert({
      id: settlementId,
      channel_id: channelId,
      amount: channel.pendingAmount,
      status: "processing",
      created_at: new Date().toISOString(),
    })

    // Execute on-chain settlement
    // In production, this would call the actual payment execution
    const txHash = await executeOnChainSettlement({
      from: channel.consumerAddress,
      to: channel.providerId,
      amount: channel.pendingAmount,
      channelId: channel.id,
    })

    // Update settlement record
    await supabase
      .from("channel_settlements")
      .update({
        status: "completed",
        transaction_hash: txHash,
        completed_at: new Date().toISOString(),
      })
      .eq("id", settlementId)

    // Update channel payments as settled
    await supabase
      .from("channel_payments")
      .update({
        status: "settled",
        settled_in_batch: settlementId,
      })
      .eq("channel_id", channelId)
      .eq("status", "accumulated")

    // Update channel balances
    const newSpent = parseFloat(channel.spentAmount) + pendingAmount

    await supabase
      .from("payment_channels")
      .update({
        spent_amount: newSpent.toString(),
        pending_amount: "0",
        status: "open",
        last_settlement_at: new Date().toISOString(),
      })
      .eq("id", channelId)

    return {
      success: true,
      settlementId,
      settledAmount: channel.pendingAmount,
      transactionHash: txHash,
    }
  } catch (error: any) {
    // Revert channel status
    await supabase
      .from("payment_channels")
      .update({ status: "open" })
      .eq("id", channelId)

    return { success: false, error: error.message }
  }
}

/**
 * Execute on-chain settlement (placeholder - integrate with payout engine)
 */
async function executeOnChainSettlement(params: {
  from: string
  to: string
  amount: string
  channelId: string
}): Promise<string> {
  // In production, this would:
  // 1. Call the Go payout-engine via gRPC
  // 2. Execute actual on-chain transaction
  // 3. Return real transaction hash

  console.log("[PB-Stream] Executing on-chain settlement:", params)

  // Simulate transaction hash
  return `0x${generateRandomHex(32)}`
}

/**
 * Schedule settlement (async, non-blocking)
 */
function scheduleSettlement(channelId: string): void {
  // In production, this would queue a settlement job
  // For now, execute immediately in background
  setImmediate(async () => {
    try {
      await settleChannel(channelId)
    } catch (error) {
      console.error(`[PB-Stream] Failed to settle channel ${channelId}:`, error)
    }
  })
}

// ============================================================================
// Channel Queries
// ============================================================================

/**
 * Get channels for a consumer
 */
export async function getConsumerChannels(
  consumerId: string,
  options?: { status?: ChannelStatus; limit?: number },
): Promise<PaymentChannel[]> {
  const supabase = await createClient()

  let query = supabase
    .from("payment_channels")
    .select("*")
    .eq("consumer_id", consumerId)
    .order("created_at", { ascending: false })

  if (options?.status) {
    query = query.eq("status", options.status)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data } = await query

  return (data || []).map(mapDbToChannel)
}

/**
 * Get channels for a provider
 */
export async function getProviderChannels(
  providerId: string,
  options?: { status?: ChannelStatus; limit?: number },
): Promise<PaymentChannel[]> {
  const supabase = await createClient()

  let query = supabase
    .from("payment_channels")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })

  if (options?.status) {
    query = query.eq("status", options.status)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data } = await query

  return (data || []).map(mapDbToChannel)
}

/**
 * Get channel payment history
 */
export async function getChannelPayments(
  channelId: string,
  limit = 100,
): Promise<ChannelPayment[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("channel_payments")
    .select("*")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data || []).map((d) => ({
    id: d.id,
    channelId: d.channel_id,
    amount: d.amount,
    resource: d.resource,
    status: d.status,
    settledInBatch: d.settled_in_batch,
    createdAt: new Date(d.created_at),
  }))
}

/**
 * Get channel statistics
 */
export async function getChannelStats(channelId: string): Promise<{
  totalPayments: number
  totalAmount: string
  avgPaymentAmount: string
  pendingSettlement: string
}> {
  const supabase = await createClient()

  const { data: payments } = await supabase
    .from("channel_payments")
    .select("amount")
    .eq("channel_id", channelId)

  const channel = await getPaymentChannel(channelId)

  const amounts = (payments || []).map((p) => parseFloat(p.amount))
  const totalAmount = amounts.reduce((sum, a) => sum + a, 0)
  const avgAmount = amounts.length > 0 ? totalAmount / amounts.length : 0

  return {
    totalPayments: amounts.length,
    totalAmount: totalAmount.toString(),
    avgPaymentAmount: avgAmount.toFixed(6),
    pendingSettlement: channel?.pendingAmount || "0",
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapDbToChannel(data: any): PaymentChannel {
  return {
    id: data.id,
    providerId: data.provider_id,
    consumerId: data.consumer_id,
    consumerAddress: data.consumer_address,
    sessionKeyPublicKey: data.session_key_public_key,
    depositAmount: data.deposit_amount,
    spentAmount: data.spent_amount,
    pendingAmount: data.pending_amount,
    settlementThreshold: data.settlement_threshold,
    autoSettleInterval: data.auto_settle_interval,
    status: data.status,
    lastSettlementAt: data.last_settlement_at ? new Date(data.last_settlement_at) : undefined,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  }
}

// ============================================================================
// Middleware Helper
// ============================================================================

/**
 * Check if request requires payment (for use in middleware)
 */
export async function checkPaymentRequired(
  providerId: string,
  sessionKeyOrChannelId: string,
  amount: string,
): Promise<{ required: boolean; channel?: PaymentChannel; error?: string }> {
  // Try to find by channel ID first
  let channel = await getPaymentChannel(sessionKeyOrChannelId)

  // If not found, try to find by session key
  if (!channel) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("payment_channels")
      .select("*")
      .eq("session_key_public_key", sessionKeyOrChannelId)
      .eq("provider_id", providerId)
      .eq("status", "open")
      .single()

    if (data) {
      channel = mapDbToChannel(data)
    }
  }

  if (!channel) {
    return { required: true, error: "No valid payment channel found" }
  }

  // Check balance
  const deposit = parseFloat(channel.depositAmount)
  const spent = parseFloat(channel.spentAmount)
  const pending = parseFloat(channel.pendingAmount)
  const available = deposit - spent - pending

  if (parseFloat(amount) > available) {
    return { required: true, channel, error: "Insufficient balance" }
  }

  return { required: false, channel }
}
