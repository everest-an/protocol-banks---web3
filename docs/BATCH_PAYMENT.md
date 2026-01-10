# Batch Payment System

## Overview

The batch payment system allows businesses to process multiple payments in a single transaction, with support for Excel/CSV import and multi-signature approval workflows.

## Features

### 1. File Import

Supports importing payment recipients from:
- **CSV files** (.csv)
- **Excel files** (.xlsx, .xls)

#### Automatic Field Detection

The system automatically detects and maps columns using flexible aliases:

| Field | Accepted Column Names |
|-------|----------------------|
| address | address, wallet, wallet_address, recipient, to, destination |
| amount | amount, value, sum, total, payment |
| token | token, currency, coin, asset, symbol |
| vendorName | vendor_name, vendor, name, payee, company |
| vendorId | vendor_id, id, reference, invoice |
| memo | memo, note, notes, description |
| chainId | chain_id, chain, network |

#### Sample Template

Download templates from the Import dropdown:
- CSV Template
- Excel Template

### 2. Multi-Signature Approval

For enhanced security, batch payments can require multi-sig approval:

```
Financial Controller creates batch payment
    ↓
Payment is submitted as multi-sig proposal
    ↓
CFO receives notification, signs transaction
    ↓
CEO receives notification, signs transaction
    ↓
Threshold reached (2 of 3), payment executes
```

#### Configuration

1. Go to **Settings > Multi-Signature**
2. Create a new multi-sig wallet
3. Add signers (wallet addresses)
4. Set threshold (e.g., 2 of 3)

#### Using Multi-sig in Batch Payment

1. On the Batch Payment page, enable "Require multi-sig approval"
2. Select your multi-sig wallet
3. Click "Submit for Approval" instead of direct payment
4. Signers will see the pending transaction in their dashboard

### 3. Data Security

All batch payment data is protected by Row Level Security (RLS):

- Users can only see their own batch payments
- Vendors are isolated by creator address
- Multi-sig transactions are only visible to wallet members
- **ProtocolBanks cannot access customer payment data**

## API Reference

### Import File

```typescript
import { parsePaymentFile } from "@/lib/excel-parser"

const result = await parsePaymentFile(file)
// result.success: boolean
// result.recipients: ParsedRecipient[]
// result.errors: string[]
// result.warnings: string[]
```

### Create Multi-sig Transaction

```typescript
import { multisigService } from "@/lib/multisig"

await multisigService.createTransaction({
  multisigId: "wallet-id",
  toAddress: "0x...",
  value: "1000",
  description: "Batch payment to vendors",
  tokenSymbol: "USDT",
  amountUsd: 1000,
  createdBy: currentWallet,
})
```

## Best Practices

1. **Always use multi-sig for large payments** - Set up approval workflows for payments above a threshold
2. **Tag your vendors** - Use the Tag feature to save recipient details for faster future payments
3. **Export before import** - Export your current recipients to CSV before making changes
4. **Review import results** - Check warnings and errors after importing files
