/**
 * SubscriptionManager contract bindings.
 *
 * Recurring charges are pulled by an on-chain contract that enforces the agreed
 * amount, interval, and recipient. The payer authorises once (an EIP-2612
 * permit plus subscription terms, in a single transaction); afterwards each
 * period is settled by calling `charge`, which anyone may submit because every
 * limit is checked on-chain.
 *
 * Contrast with the ERC-3009 path in `subscription-payment-executor.ts`: there a
 * signature is single-use, so the payer must pre-sign one authorization per
 * period. That path remains the fallback on chains where this contract is not
 * deployed.
 */

import type { Address, Hex } from 'viem'

// ============================================
// Deployments
// ============================================

/**
 * Deployed SubscriptionManager per chain. Empty until deployment — callers must
 * treat a missing entry as "this chain cannot use the contract path".
 *
 * Populate from `contracts/scripts/deploy-subscription-manager.ts` output.
 */
export const SUBSCRIPTION_MANAGER_CONTRACTS: Record<number, Address> = {
  // Ethereum Sepolia — testnet. Verified end-to-end on 2026-07-28: one-transaction
  // setup via permit, three charges, budget exhaustion, contract balance 0.
  11155111: '0xf4dd5E549Cdaa9706bbC11b29FBE18c8fe888981',

  // Mainnets — add only after a third-party audit.
  // 42161: '0x...', // Arbitrum
  // 8453:  '0x...', // Base
  // 1:     '0x...', // Ethereum
}

export function getSubscriptionManagerAddress(chainId: number): Address | null {
  return SUBSCRIPTION_MANAGER_CONTRACTS[chainId] || null
}

export function isSubscriptionManagerDeployed(chainId: number): boolean {
  return !!SUBSCRIPTION_MANAGER_CONTRACTS[chainId]
}

// ============================================
// ABI
// ============================================

/**
 * Fields of `SubscriptionManager.SubscriptionTerms`, shared by both creation
 * entry points. Order must match the Solidity struct exactly — ABI tuples are
 * positional, so a reordering here silently mis-assigns every field.
 */
const SUBSCRIPTION_TERMS_COMPONENTS = [
  { name: 'merchant', type: 'address' },
  { name: 'token', type: 'address' },
  { name: 'amountPerPeriod', type: 'uint256' },
  { name: 'totalAuthorised', type: 'uint256' },
  { name: 'periodSeconds', type: 'uint64' },
  { name: 'firstChargeAt', type: 'uint64' },
  { name: 'endTime', type: 'uint64' },
  { name: 'noticeSeconds', type: 'uint64' },
  { name: 'maxPeriods', type: 'uint32' },
] as const

export const SUBSCRIPTION_MANAGER_ABI = [
  {
    type: 'function',
    name: 'createSubscription',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'terms',
        type: 'tuple',
        components: SUBSCRIPTION_TERMS_COMPONENTS,
      },
    ],
    outputs: [{ name: 'subscriptionId', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'createSubscriptionWithPermit',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'terms',
        type: 'tuple',
        components: SUBSCRIPTION_TERMS_COMPONENTS,
      },
      { name: 'permitValue', type: 'uint256' },
      { name: 'permitDeadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [{ name: 'subscriptionId', type: 'bytes32' }],
  },
  {
    // Starts the notice period for a due charge. Only required when the
    // subscription sets noticeSeconds; the wait is what lets a payer cancel
    // without racing the merchant.
    type: 'function',
    name: 'announceCharge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isAnnounceable',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'availableAuthorisation',
    stateMutability: 'view',
    inputs: [
      { name: 'payer', type: 'address' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowedTokens',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'charge',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancel',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isChargeable',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getSubscription',
    stateMutability: 'view',
    inputs: [{ name: 'subscriptionId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'payer', type: 'address' },
          { name: 'merchant', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'amountPerPeriod', type: 'uint256' },
          { name: 'remainingAuthorised', type: 'uint256' },
          { name: 'periodSeconds', type: 'uint64' },
          { name: 'nextChargeAt', type: 'uint64' },
          { name: 'endTime', type: 'uint64' },
          { name: 'noticeSeconds', type: 'uint64' },
          { name: 'announcedAt', type: 'uint64' },
          { name: 'periodsCharged', type: 'uint32' },
          { name: 'maxPeriods', type: 'uint32' },
          { name: 'cancelled', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionCreated',
    inputs: [
      { name: 'subscriptionId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'amountPerPeriod', type: 'uint256', indexed: false },
      { name: 'periodSeconds', type: 'uint64', indexed: false },
      { name: 'firstChargeAt', type: 'uint64', indexed: false },
      { name: 'endTime', type: 'uint64', indexed: false },
      { name: 'maxPeriods', type: 'uint32', indexed: false },
    ],
  },
  {
    // Emitted when a charge lands late enough that periods are skipped rather
    // than accumulated. Those periods are never charged — surface this to
    // merchants instead of letting revenue vanish silently.
    type: 'event',
    name: 'PeriodsSkipped',
    inputs: [
      { name: 'subscriptionId', type: 'bytes32', indexed: true },
      { name: 'missedDue', type: 'uint64', indexed: false },
      { name: 'rebasedTo', type: 'uint64', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SubscriptionCharged',
    inputs: [
      { name: 'subscriptionId', type: 'bytes32', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'periodIndex', type: 'uint32', indexed: false },
      { name: 'nextChargeAt', type: 'uint64', indexed: false },
    ],
  },
] as const

// ============================================
// Frequency mapping
// ============================================

const FREQUENCY_SECONDS: Record<string, number> = {
  daily: 24 * 60 * 60,
  weekly: 7 * 24 * 60 * 60,
  monthly: 30 * 24 * 60 * 60,
  quarterly: 90 * 24 * 60 * 60,
  yearly: 365 * 24 * 60 * 60,
}

/**
 * Period length in seconds for a subscription frequency.
 *
 * Note this is a fixed interval, so "monthly" is 30 days rather than a calendar
 * month — the contract enforces a minimum elapsed time and cannot track calendar
 * boundaries. Charges are triggered by the scheduler on the calendar date; this
 * value only sets the floor that prevents charging early.
 */
export function frequencyToSeconds(frequency: string): number {
  const seconds = FREQUENCY_SECONDS[frequency]
  if (!seconds) {
    throw new Error(`Unsupported subscription frequency: ${frequency}`)
  }
  return seconds
}

export interface OnChainSubscription {
  payer: Address
  merchant: Address
  token: Address
  amountPerPeriod: bigint
  /** Remaining lifetime budget reserved for this subscription alone. */
  remainingAuthorised: bigint
  periodSeconds: bigint
  nextChargeAt: bigint
  endTime: bigint
  /** Delay between announcing a charge and executing it. 0 = no notice. */
  noticeSeconds: bigint
  /** When the pending charge was announced. 0 = none pending. */
  announcedAt: bigint
  periodsCharged: number
  maxPeriods: number
  cancelled: boolean
}

export function isSubscriptionId(value: string | null | undefined): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value)
}
