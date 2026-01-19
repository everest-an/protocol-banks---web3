# Requirements Document

## Introduction

x402 Protocol 是 ProtocolBanks 的核心创新，基于 ERC-3009 (TransferWithAuthorization) 标准。该协议实现 gasless 支付，允许授权者签署支付授权，由 relayer 代付 gas 费用。这是实现 Agent-to-Agent 商业和 CFO 无需 ETH 即可批准支付的关键技术。

## Glossary

- **x402_Protocol**: 基于 ERC-3009 的 gasless 支付协议
- **Authorizer**: 授权者，签署支付授权的用户
- **Relayer**: 中继者，代付 gas 费用并提交交易的服务
- **EIP-712**: 以太坊改进提案 712，用于结构化数据签名
- **TransferWithAuthorization**: ERC-3009 标准函数，用于授权转账
- **Nonce**: 一次性数字，防止重放攻击
- **Signature**: 授权者的 EIP-712 签名

## Requirements

### Requirement 1: EIP-712 签名生成

**User Story:** As a CFO, I want to sign payment authorizations without broadcasting transactions, so that I can approve payments without needing ETH for gas.

#### Acceptance Criteria

1. WHEN a user initiates a payment, THE x402_Protocol SHALL generate EIP-712 domain separator
2. THE x402_Protocol SHALL include domain: name, version, chainId, verifyingContract
3. THE x402_Protocol SHALL create TransferWithAuthorization struct with: from, to, value, validAfter, validBefore, nonce, data
4. WHEN user signs, THE x402_Protocol SHALL use personal_sign or eth_signTypedData_v4
5. THE x402_Protocol SHALL verify signature matches the authorizer's address
6. IF signature is invalid, THEN THE x402_Protocol SHALL reject the authorization
7. WHEN signature is valid, THE x402_Protocol SHALL store it for relayer submission

### Requirement 2: Nonce 管理与防重放

**User Story:** As a security officer, I want to prevent replay attacks, so that authorizations cannot be reused.

#### Acceptance Criteria

1. THE x402_Protocol SHALL maintain a nonce counter per authorizer per token
2. WHEN an authorization is created, THE x402_Protocol SHALL increment the nonce
3. THE x402_Protocol SHALL store used nonces in used_nonces table
4. WHEN a relayer submits a transaction, THE x402_Protocol SHALL verify nonce hasn't been used
5. IF nonce is already used, THEN THE x402_Protocol SHALL reject the transaction
6. THE x402_Protocol SHALL support nonce queries (get current nonce for authorizer)
7. WHEN nonce overflows, THE x402_Protocol SHALL handle gracefully (reset or error)

### Requirement 3: 签名有效期管理

**User Story:** As a user, I want my authorizations to expire, so that old signatures cannot be used.

#### Acceptance Criteria

1. WHEN an authorization is created, THE x402_Protocol SHALL set validAfter (current time)
2. THE x402_Protocol SHALL set validBefore (current time + duration, default 1 hour)
3. WHEN a relayer submits a transaction, THE x402_Protocol SHALL verify current time is within validity window
4. IF transaction is submitted after validBefore, THEN THE x402_Protocol SHALL reject it
5. THE x402_Protocol SHALL support configurable validity duration per authorization
6. WHEN authorization expires, THE x402_Protocol SHALL log expiration for audit
7. THE x402_Protocol SHALL provide expiration time to user before signing

### Requirement 4: Relayer 架构与提交

**User Story:** As a relayer operator, I want to submit authorizations on-chain, so that I can earn fees for gas payment.

#### Acceptance Criteria

1. THE Relayer SHALL accept signed authorizations via API
2. THE Relayer SHALL validate signature before submission
3. THE Relayer SHALL estimate gas cost and verify profitability
4. WHEN gas is profitable, THE Relayer SHALL submit transaction to blockchain
5. THE Relayer SHALL track transaction hash and monitor on-chain status
6. WHEN transaction succeeds, THE Relayer SHALL mark authorization as executed
7. IF transaction fails, THE Relayer SHALL retry with higher gas price (up to 3 times)

### Requirement 5: 链上验证与执行

**User Story:** As a smart contract, I want to verify and execute authorizations, so that payments are secure and atomic.

#### Acceptance Criteria

1. WHEN a TransferWithAuthorization transaction is submitted, THE smart contract SHALL verify signature
2. THE smart contract SHALL verify nonce hasn't been used
3. THE smart contract SHALL verify current time is within validity window
4. THE smart contract SHALL verify authorizer has sufficient balance
5. WHEN all checks pass, THE smart contract SHALL execute the transfer
6. THE smart contract SHALL mark nonce as used to prevent replay
7. IF any check fails, THE smart contract SHALL revert the transaction

### Requirement 6: 费用分配与激励

**User Story:** As a relayer, I want to earn fees for submitting transactions, so that I'm incentivized to provide service.

#### Acceptance Criteria

1. WHEN an authorization is executed, THE x402_Protocol SHALL deduct relayer fee from transfer amount
2. THE x402_Protocol SHALL support configurable fee percentage (default 0.5%)
3. THE x402_Protocol SHALL transfer relayer fee to relayer's address
4. THE x402_Protocol SHALL log fee distribution for audit
5. WHEN fee is deducted, THE x402_Protocol SHALL notify authorizer of actual amount received
6. THE x402_Protocol SHALL support fee caps (maximum fee per transaction)
7. WHEN fee exceeds cap, THE x402_Protocol SHALL reject the authorization

### Requirement 7: 错误处理与恢复

**User Story:** As a user, I want clear error messages when authorizations fail, so that I can resolve issues quickly.

#### Acceptance Criteria

1. IF signature is invalid, THEN THE x402_Protocol SHALL return specific error (invalid signature, wrong signer, etc.)
2. IF nonce is already used, THEN THE x402_Protocol SHALL return error with current nonce
3. IF authorization is expired, THEN THE x402_Protocol SHALL return error with expiration time
4. IF balance is insufficient, THEN THE x402_Protocol SHALL return error with required balance
5. WHEN relayer submission fails, THE x402_Protocol SHALL provide on-chain error reason
6. THE x402_Protocol SHALL support authorization cancellation (mark nonce as used)
7. WHEN authorization fails, THE x402_Protocol SHALL provide recovery options

### Requirement 8: 监控与审计

**User Story:** As an operator, I want to monitor all x402 transactions, so that I can detect anomalies and ensure compliance.

#### Acceptance Criteria

1. THE x402_Protocol SHALL log all authorization creations with timestamp and authorizer
2. THE x402_Protocol SHALL log all relayer submissions with transaction hash
3. THE x402_Protocol SHALL log all on-chain executions with amount and recipient
4. THE x402_Protocol SHALL log all failures with error reason
5. WHEN suspicious patterns are detected, THE x402_Protocol SHALL alert operators
6. THE x402_Protocol SHALL provide audit trail for compliance reporting
7. WHEN transaction completes, THE x402_Protocol SHALL generate receipt with all details

### Requirement 9: 多链支持

**User Story:** As a user, I want to use x402 on multiple chains, so that I can manage cross-chain payments.

#### Acceptance Criteria

1. THE x402_Protocol SHALL support Ethereum Mainnet
2. THE x402_Protocol SHALL support Polygon
3. THE x402_Protocol SHALL support Arbitrum
4. THE x402_Protocol SHALL support Optimism
5. THE x402_Protocol SHALL support Base
6. WHEN user selects chain, THE x402_Protocol SHALL use correct domain separator
7. THE x402_Protocol SHALL prevent cross-chain signature reuse

### Requirement 10: 与 Agent Link API 集成

**User Story:** As an AI Agent, I want to use x402 for payments, so that I can execute transactions without needing ETH.

#### Acceptance Criteria

1. WHEN an Agent creates a payment proposal, THE x402_Protocol SHALL support x402 as payment method
2. THE x402_Protocol SHALL generate authorization for Agent to sign
3. WHEN Agent signs, THE x402_Protocol SHALL submit to relayer
4. THE x402_Protocol SHALL track Agent payment authorizations separately
5. WHEN Agent authorization is executed, THE x402_Protocol SHALL log it for Agent accounting
6. THE x402_Protocol SHALL support Agent-specific fee structures
7. WHEN Agent payment completes, THE x402_Protocol SHALL update Agent budget

