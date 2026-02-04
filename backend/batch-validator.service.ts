/**
 * Batch Validator Service
 * Validates batch payment data
 */

import { isValidAddress } from './account-validator.service'

export interface BatchPaymentItem {
  recipient: string
  amount: string | number
  token?: string
  memo?: string
}

export interface BatchValidationResult {
  valid: boolean
  errors: BatchValidationError[]
  validItems: BatchPaymentItem[]
  invalidItems: { item: BatchPaymentItem; errors: string[] }[]
}

export interface BatchValidationError {
  row: number
  field: string
  message: string
}

// Maximum batch size
export const MAX_BATCH_SIZE = 100

// Minimum amount
export const MIN_AMOUNT = 0.000001

/**
 * Validate a single batch payment item
 */
export function validateBatchItem(
  item: BatchPaymentItem,
  index: number
): { valid: boolean; errors: BatchValidationError[] } {
  const errors: BatchValidationError[] = []
  
  // Validate recipient address
  if (!item.recipient) {
    errors.push({ row: index, field: 'recipient', message: 'Recipient address is required' })
  } else if (!isValidAddress(item.recipient)) {
    errors.push({ row: index, field: 'recipient', message: 'Invalid recipient address' })
  }
  
  // Validate amount
  const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
  if (isNaN(amount)) {
    errors.push({ row: index, field: 'amount', message: 'Invalid amount' })
  } else if (amount < MIN_AMOUNT) {
    errors.push({ row: index, field: 'amount', message: `Amount must be at least ${MIN_AMOUNT}` })
  } else if (amount > Number.MAX_SAFE_INTEGER) {
    errors.push({ row: index, field: 'amount', message: 'Amount exceeds maximum value' })
  }
  
  // Validate memo if present
  if (item.memo && item.memo.length > 256) {
    errors.push({ row: index, field: 'memo', message: 'Memo must be 256 characters or less' })
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Validate entire batch
 */
export function validateBatch(items: BatchPaymentItem[]): BatchValidationResult {
  const errors: BatchValidationError[] = []
  const validItems: BatchPaymentItem[] = []
  const invalidItems: { item: BatchPaymentItem; errors: string[] }[] = []
  
  // Check batch size
  if (items.length === 0) {
    errors.push({ row: -1, field: 'batch', message: 'Batch cannot be empty' })
    return { valid: false, errors, validItems, invalidItems }
  }
  
  if (items.length > MAX_BATCH_SIZE) {
    errors.push({
      row: -1,
      field: 'batch',
      message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
    })
    return { valid: false, errors, validItems, invalidItems }
  }
  
  // Validate each item
  items.forEach((item, index) => {
    const result = validateBatchItem(item, index)
    if (result.valid) {
      validItems.push(item)
    } else {
      errors.push(...result.errors)
      invalidItems.push({
        item,
        errors: result.errors.map(e => e.message),
      })
    }
  })
  
  return {
    valid: invalidItems.length === 0,
    errors,
    validItems,
    invalidItems,
  }
}

/**
 * Check for duplicate recipients in batch
 */
export function findDuplicateRecipients(items: BatchPaymentItem[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  
  items.forEach(item => {
    const addr = item.recipient.toLowerCase()
    if (seen.has(addr)) {
      duplicates.add(addr)
    }
    seen.add(addr)
  })
  
  return Array.from(duplicates)
}

/**
 * Calculate batch totals
 */
export function calculateBatchTotals(items: BatchPaymentItem[]): {
  totalAmount: number
  itemCount: number
  uniqueRecipients: number
} {
  const recipients = new Set<string>()
  let totalAmount = 0
  
  items.forEach(item => {
    const amount = typeof item.amount === 'string' ? parseFloat(item.amount) : item.amount
    if (!isNaN(amount)) {
      totalAmount += amount
    }
    recipients.add(item.recipient.toLowerCase())
  })
  
  return {
    totalAmount,
    itemCount: items.length,
    uniqueRecipients: recipients.size,
  }
}
