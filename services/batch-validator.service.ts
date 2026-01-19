import { isAddress } from "ethers"
import { z } from "zod"
import { getToken } from "@/services/token-metadata.service"

export type ValidationError = { row: number; error: string }
export type ValidationSummary = { valid: number; invalid: number; warnings: number }
export type ValidationResult = {
  validItems: ValidPaymentItem[]
  invalidItems: ValidationError[]
  summary: ValidationSummary
}

export type ValidPaymentItem = {
  recipient_address: string
  amount: string
  token_symbol: string
  row: number
  chain_id: number
  token_address: string
}

const AmountSchema = z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a positive number")

export function validateBatch(
  items: { recipient_address: string; amount: string; token_symbol: string; row: number; chain_id?: number }[],
  defaultChainId = 1,
): ValidationResult {
  const errors: ValidationError[] = []
  const seen = new Set<string>()
  const valid: ValidPaymentItem[] = []

  for (const item of items) {
    const rowId = item.row
    const addr = item.recipient_address
    const symbol = item.token_symbol.toUpperCase()
    const chainId = item.chain_id ?? defaultChainId

    if (!isAddress(addr)) {
      errors.push({ row: rowId, error: "Invalid Ethereum address" })
      continue
    }

    if (!AmountSchema.safeParse(item.amount).success) {
      errors.push({ row: rowId, error: "Invalid amount" })
      continue
    }

    const token = getToken(symbol, chainId)
    if (!token) {
      errors.push({ row: rowId, error: "Unsupported token" })
      continue
    }

    const dupKey = `${addr.toLowerCase()}-${symbol}-${chainId}`
    if (seen.has(dupKey)) {
      errors.push({ row: rowId, error: "Duplicate recipient in batch" })
      continue
    }
    seen.add(dupKey)

    valid.push({
      recipient_address: addr,
      amount: item.amount,
      token_symbol: symbol,
      row: rowId,
      chain_id: chainId,
      token_address: token.address,
    })
  }

  return {
    validItems: valid,
    invalidItems: errors,
    summary: {
      valid: valid.length,
      invalid: errors.length,
      warnings: 0,
    },
  }
}
