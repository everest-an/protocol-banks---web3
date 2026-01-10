# Requirements Document

## Introduction

法币出入金系统 (Fiat On/Off Ramp) 是 ProtocolBanks 的核心功能之一，允许用户使用信用卡、银行转账等传统支付方式购买加密货币，或将加密货币兑换为法币提现到银行账户。该功能将打通 Web2 与 Web3 的资金通道，降低用户进入加密世界的门槛。

## Glossary

- **Fiat_Gateway**: 法币网关服务，负责处理法币与加密货币之间的转换
- **KYC_Service**: 身份验证服务，负责用户身份核实和合规检查
- **Payment_Processor**: 支付处理器，处理信用卡和银行转账
- **Liquidity_Provider**: 流动性提供商，提供法币-加密货币兑换的流动性
- **On_Ramp**: 入金通道，法币转加密货币
- **Off_Ramp**: 出金通道，加密货币转法币
- **Settlement_Engine**: 结算引擎，处理交易结算和资金划转

## Requirements

### Requirement 1: 用户身份验证 (KYC)

**User Story:** As a user, I want to complete identity verification, so that I can access fiat on/off ramp services in compliance with regulations.

#### Acceptance Criteria

1. WHEN a user initiates their first fiat transaction, THE KYC_Service SHALL prompt for identity verification
2. WHEN a user submits identity documents, THE KYC_Service SHALL validate document authenticity within 24 hours
3. WHILE KYC verification is pending, THE Fiat_Gateway SHALL restrict transaction limits to $100 USD equivalent
4. WHEN KYC verification is approved, THE Fiat_Gateway SHALL unlock full transaction limits based on user tier
5. IF KYC verification fails, THEN THE KYC_Service SHALL provide specific rejection reasons and allow resubmission
6. THE KYC_Service SHALL support government-issued ID from 180+ countries
7. THE KYC_Service SHALL store identity data encrypted with AES-256-GCM

### Requirement 2: 信用卡入金 (Card On-Ramp)

**User Story:** As a user, I want to buy cryptocurrency using my credit/debit card, so that I can quickly fund my wallet without complex bank transfers.

#### Acceptance Criteria

1. WHEN a user selects card payment, THE Payment_Processor SHALL display supported card networks (Visa, Mastercard, Apple Pay, Google Pay)
2. WHEN a user enters card details, THE Payment_Processor SHALL tokenize card data without storing raw card numbers
3. WHEN a card payment is authorized, THE Fiat_Gateway SHALL execute the crypto purchase within 30 seconds
4. THE Fiat_Gateway SHALL display real-time exchange rates with a maximum 2% spread
5. WHEN a transaction completes, THE Fiat_Gateway SHALL deliver purchased crypto to user's wallet within 5 minutes
6. IF card payment fails, THEN THE Payment_Processor SHALL return specific error codes and suggest alternatives
7. THE Payment_Processor SHALL support 3D Secure authentication for fraud prevention
8. THE Fiat_Gateway SHALL enforce daily limits: $500 (unverified), $10,000 (KYC Level 1), $50,000 (KYC Level 2)

### Requirement 3: 银行转账入金 (Bank Transfer On-Ramp)

**User Story:** As a user, I want to buy cryptocurrency via bank transfer, so that I can make larger purchases with lower fees.

#### Acceptance Criteria

1. WHEN a user selects bank transfer, THE Fiat_Gateway SHALL generate unique deposit instructions with reference code
2. THE Fiat_Gateway SHALL support SEPA (EUR), ACH (USD), Faster Payments (GBP), and SWIFT transfers
3. WHEN a bank deposit is detected, THE Settlement_Engine SHALL credit user account within 1 business day for SEPA/ACH
4. WHEN a SWIFT transfer is received, THE Settlement_Engine SHALL credit user account within 3 business days
5. THE Fiat_Gateway SHALL provide real-time deposit status tracking
6. IF deposit reference is missing, THEN THE Settlement_Engine SHALL attempt automatic matching by amount and sender
7. THE Fiat_Gateway SHALL charge 0.5% fee for bank transfers (minimum $1, maximum $50)

### Requirement 4: 加密货币出金 (Crypto Off-Ramp)

**User Story:** As a user, I want to sell cryptocurrency and withdraw to my bank account, so that I can convert my crypto holdings to fiat currency.

#### Acceptance Criteria

1. WHEN a user initiates off-ramp, THE Fiat_Gateway SHALL display current sell rates with all fees included
2. WHEN a user confirms sell order, THE Settlement_Engine SHALL lock the exchange rate for 60 seconds
3. WHEN crypto is received, THE Settlement_Engine SHALL initiate bank transfer within 24 hours
4. THE Fiat_Gateway SHALL support withdrawals to verified bank accounts only
5. WHEN adding a new bank account, THE KYC_Service SHALL verify account ownership via micro-deposits
6. IF withdrawal amount exceeds $10,000, THEN THE Fiat_Gateway SHALL require additional verification
7. THE Fiat_Gateway SHALL provide withdrawal tracking with estimated arrival time
8. THE Settlement_Engine SHALL batch small withdrawals to optimize banking fees

### Requirement 5: 汇率和费用透明度

**User Story:** As a user, I want to see clear pricing before transactions, so that I can make informed decisions about my purchases and sales.

#### Acceptance Criteria

1. THE Fiat_Gateway SHALL display exchange rate, network fee, and service fee separately before confirmation
2. WHEN exchange rate changes by more than 1%, THE Fiat_Gateway SHALL refresh quote and require re-confirmation
3. THE Fiat_Gateway SHALL show comparison with market rate (CoinGecko/CoinMarketCap)
4. WHEN a transaction completes, THE Fiat_Gateway SHALL provide detailed receipt with all fee breakdowns
5. THE Fiat_Gateway SHALL display historical exchange rates for the past 24 hours
6. THE Fiat_Gateway SHALL support price alerts for target exchange rates

### Requirement 6: 多币种和多链支持

**User Story:** As a user, I want to buy/sell various cryptocurrencies on different chains, so that I can manage my diverse portfolio through one platform.

#### Acceptance Criteria

1. THE Fiat_Gateway SHALL support on-ramp for: BTC, ETH, USDT, USDC, SOL, MATIC, and ZETA
2. THE Fiat_Gateway SHALL support off-ramp for: BTC, ETH, USDT, USDC
3. WHEN purchasing tokens, THE Fiat_Gateway SHALL allow chain selection (Ethereum, Polygon, Arbitrum, Base, Solana)
4. THE Fiat_Gateway SHALL support fiat currencies: USD, EUR, GBP, JPY, KRW, SGD, AUD, CAD
5. WHEN user's preferred currency is unavailable, THE Fiat_Gateway SHALL offer automatic conversion with disclosed rates
6. THE Liquidity_Provider SHALL maintain sufficient reserves for 99.9% order fulfillment

### Requirement 7: 合规和风控

**User Story:** As a platform operator, I want robust compliance controls, so that the platform meets regulatory requirements and prevents fraud.

#### Acceptance Criteria

1. THE Fiat_Gateway SHALL implement transaction monitoring for suspicious patterns
2. WHEN a transaction triggers risk rules, THE Fiat_Gateway SHALL hold for manual review
3. THE KYC_Service SHALL perform sanctions screening against OFAC, EU, and UN lists
4. THE Fiat_Gateway SHALL maintain complete audit trail for all transactions (7 years retention)
5. WHEN regulatory reporting is required, THE Fiat_Gateway SHALL generate SAR/CTR reports automatically
6. THE Fiat_Gateway SHALL block transactions from/to sanctioned jurisdictions
7. IF user attempts to circumvent limits, THEN THE Fiat_Gateway SHALL flag account for review

### Requirement 8: 第三方集成

**User Story:** As a developer, I want to integrate fiat on/off ramp via API, so that I can offer these services in my own application.

#### Acceptance Criteria

1. THE Fiat_Gateway SHALL provide REST API for programmatic access
2. THE Fiat_Gateway SHALL support webhook notifications for transaction status updates
3. WHEN API key is created, THE Fiat_Gateway SHALL allow IP whitelist configuration
4. THE Fiat_Gateway SHALL provide SDK for JavaScript, Python, and Go
5. THE Fiat_Gateway SHALL rate limit API calls to 100 requests per minute per key
6. THE Fiat_Gateway SHALL provide sandbox environment for testing
7. WHEN API errors occur, THE Fiat_Gateway SHALL return standardized error codes with descriptions

