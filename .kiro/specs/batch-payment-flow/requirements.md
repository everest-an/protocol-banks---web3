# Requirements Document

## Introduction

批量支付完整流程是 ProtocolBanks 的核心企业功能。该功能允许用户通过 CSV/Excel 文件导入多个收款人，进行混合代币支付，并支持 ERC-3009 (x402 Protocol) 的 gasless 支付。这是企业级财务管理的关键功能。

## Glossary

- **Payment_Processor**: 支付处理器，处理支付执行和链上交互
- **File_Parser**: 文件解析器，解析 CSV/Excel 文件
- **Batch_Validator**: 批量验证器，验证支付数据完整性
- **Fee_Calculator**: 费用计算器，计算网络费和服务费
- **Transaction_Executor**: 交易执行器，执行链上交易
- **Batch_Payment**: 批量支付，包含多个支付项的集合
- **Payment_Item**: 支付项，单个支付的详细信息

## Requirements

### Requirement 1: 文件导入与解析

**User Story:** As a user, I want to import payment recipients from CSV or Excel files, so that I can process large batches efficiently.

#### Acceptance Criteria

1. WHEN a user uploads a CSV file, THE File_Parser SHALL parse it and extract payment data
2. WHEN a user uploads an Excel file, THE File_Parser SHALL parse it and extract payment data
3. THE File_Parser SHALL support flexible column name mapping (address, wallet, recipient, to, destination)
4. THE File_Parser SHALL detect and report parsing errors with line numbers
5. IF a file is malformed, THEN THE File_Parser SHALL reject it and suggest corrections
6. THE File_Parser SHALL support files with up to 10,000 rows
7. WHEN parsing completes, THE File_Parser SHALL return structured payment data with validation status

### Requirement 2: 数据验证与清理

**User Story:** As a system, I want to validate all payment data before execution, so that invalid payments don't fail on-chain.

#### Acceptance Criteria

1. THE Batch_Validator SHALL validate all Ethereum addresses (checksum validation)
2. THE Batch_Validator SHALL validate all amounts (positive numbers, within limits)
3. THE Batch_Validator SHALL validate all token symbols (supported tokens only)
4. THE Batch_Validator SHALL check for duplicate recipients in the same batch
5. IF validation fails, THEN THE Batch_Validator SHALL report specific errors per row
6. THE Batch_Validator SHALL support partial batch processing (skip invalid rows, process valid ones)
7. WHEN validation completes, THE Batch_Validator SHALL provide a summary (valid: X, invalid: Y, warnings: Z)

### Requirement 3: 多代币混合支付

**User Story:** As a user, I want to pay different recipients in different tokens, so that I can optimize costs and recipient preferences.

#### Acceptance Criteria

1. THE Payment_Processor SHALL support mixed-token batches (USDT, USDC, DAI, ETH, etc.)
2. WHEN a batch contains multiple tokens, THE Payment_Processor SHALL group payments by token
3. THE Payment_Processor SHALL execute separate transactions for each token
4. THE Payment_Processor SHALL maintain atomic semantics (all succeed or all fail)
5. WHEN a token transfer fails, THE Payment_Processor SHALL rollback all payments in that batch
6. THE Payment_Processor SHALL support token allowance checking and approval if needed
7. WHEN batch completes, THE Payment_Processor SHALL provide per-token execution summary

### Requirement 4: 费用计算与透明度

**User Story:** As a user, I want to see all fees before confirming payment, so that I can make informed decisions.

#### Acceptance Criteria

1. THE Fee_Calculator SHALL calculate network fees (gas costs) for each transaction
2. THE Fee_Calculator SHALL calculate service fees (ProtocolBanks fee percentage)
3. THE Fee_Calculator SHALL display total cost = sum of payments + all fees
4. WHEN fees change, THE Fee_Calculator SHALL notify the user and require re-confirmation
5. THE Fee_Calculator SHALL support fee estimation before execution
6. THE Fee_Calculator SHALL provide fee breakdown per token and per recipient
7. WHEN batch executes, THE Fee_Calculator SHALL log actual fees for audit

### Requirement 5: ERC-3009 (x402 Protocol) 支持

**User Story:** As a CFO, I want gasless payments using x402 Protocol, so that I don't need ETH in my wallet for gas.

#### Acceptance Criteria

1. WHEN a user selects x402 payment method, THE Payment_Processor SHALL generate EIP-712 signatures
2. THE Payment_Processor SHALL create TransferWithAuthorization calls for each payment
3. THE Payment_Processor SHALL manage nonces to prevent replay attacks
4. THE Payment_Processor SHALL set signature expiration (default 1 hour)
5. WHEN signatures are collected, THE Payment_Processor SHALL submit to relayer
6. THE Payment_Processor SHALL verify relayer execution on-chain
7. IF relayer fails, THE Payment_Processor SHALL provide fallback to standard transfer

### Requirement 6: 交易签名与执行

**User Story:** As a user, I want my transactions to be signed securely, so that I maintain control over my funds.

#### Acceptance Criteria

1. WHEN a user confirms a batch, THE Payment_Processor SHALL prompt for PIN
2. THE Payment_Processor SHALL reconstruct private key from Shamir shares using PIN
3. THE Payment_Processor SHALL sign all transactions with the private key
4. THE Payment_Processor SHALL immediately destroy the private key after signing
5. WHEN transactions are signed, THE Payment_Processor SHALL submit them to the blockchain
6. THE Payment_Processor SHALL track transaction hashes for monitoring
7. IF signing fails, THEN THE Payment_Processor SHALL reject the batch and log the error

### Requirement 7: 交易追踪与状态管理

**User Story:** As a user, I want to track the status of my batch payments, so that I know when they complete.

#### Acceptance Criteria

1. WHEN a batch is submitted, THE Payment_Processor SHALL create a batch_payments record
2. THE Payment_Processor SHALL track status: pending → processing → completed/failed
3. WHEN individual payments complete, THE Payment_Processor SHALL update payment status
4. THE Payment_Processor SHALL provide real-time status updates (via polling or WebSocket)
5. WHEN a payment fails, THE Payment_Processor SHALL provide specific error reason
6. THE Payment_Processor SHALL support batch retry for failed payments
7. WHEN batch completes, THE Payment_Processor SHALL generate a detailed report

### Requirement 8: 错误处理与恢复

**User Story:** As a user, I want clear error messages and recovery options, so that I can resolve issues quickly.

#### Acceptance Criteria

1. IF file parsing fails, THEN THE File_Parser SHALL provide specific error with line number
2. IF validation fails, THEN THE Batch_Validator SHALL provide per-row error details
3. IF transaction fails, THEN THE Payment_Processor SHALL provide on-chain error reason
4. IF batch partially fails, THEN THE Payment_Processor SHALL allow retry for failed payments only
5. THE Payment_Processor SHALL support batch cancellation before execution
6. WHEN a batch fails, THE Payment_Processor SHALL provide recovery options (retry, modify, cancel)
7. THE Payment_Processor SHALL maintain audit trail of all errors for debugging

### Requirement 9: 草稿保存与恢复

**User Story:** As a user, I want to save my batch as a draft, so that I can complete it later without losing data.

#### Acceptance Criteria

1. WHEN a user is preparing a batch, THE Payment_Processor SHALL allow saving as draft
2. THE Payment_Processor SHALL store draft locally (browser storage) and on server
3. WHEN a user returns, THE Payment_Processor SHALL restore the draft automatically
4. THE Payment_Processor SHALL support multiple draft versions
5. WHEN a draft is submitted, THE Payment_Processor SHALL archive it for audit
6. THE Payment_Processor SHALL support draft expiration (30 days)
7. WHEN a draft expires, THE Payment_Processor SHALL notify the user

### Requirement 10: 多签审批集成

**User Story:** As a CFO, I want batch payments to require multi-sig approval, so that I maintain control over large payments.

#### Acceptance Criteria

1. WHEN a batch exceeds threshold, THE Payment_Processor SHALL require multi-sig approval
2. THE Payment_Processor SHALL submit batch as multi-sig proposal
3. WHEN signers approve, THE Payment_Processor SHALL execute the batch
4. IF signers reject, THEN THE Payment_Processor SHALL cancel the batch
5. THE Payment_Processor SHALL support configurable approval threshold
6. WHEN batch is approved, THE Payment_Processor SHALL log all approvals for audit
7. THE Payment_Processor SHALL support approval delegation

