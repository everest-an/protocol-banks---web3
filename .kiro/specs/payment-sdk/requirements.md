# Requirements Document

## Introduction

ProtocolBanks Payment SDK 是一套多语言 SDK，允许开发者在自己的应用中集成加密货币支付收单功能。SDK 支持多种加密货币（USDC、USDT、DAI、ETH、BTC、SOL 等）、多条区块链（Ethereum、Polygon、Base、Arbitrum、Solana、Bitcoin），提供易于部署的嵌入式收款组件，让商户可以在几分钟内在自己的网站上开始收取加密货币。

## Glossary

- **SDK**: Software Development Kit，软件开发工具包
- **Payment_Link**: 签名的支付链接，包含收款地址、金额、代币、过期时间和签名
- **QR_Code**: 二维码，编码支付链接供扫描
- **Checkout_Widget**: 嵌入式收款组件，可直接嵌入商户网页
- **Payment_Button**: 一键支付按钮组件
- **x402_Protocol**: 基于 EIP-712/ERC-3009 的 Gasless 支付协议
- **Webhook**: 服务器回调通知，用于接收支付状态更新
- **API_Key**: 用于认证 SDK 请求的密钥
- **Merchant**: 使用 SDK 的商户/开发者
- **Payer**: 执行支付的用户
- **Multi_Chain**: 多链支持，包括 EVM 链、Solana、Bitcoin
- **Stablecoin**: 稳定币，如 USDC、USDT、DAI

## Requirements

### Requirement 1: SDK 初始化与认证

**User Story:** As a developer, I want to initialize the SDK with my API credentials, so that I can securely access ProtocolBanks payment services.

#### Acceptance Criteria

1. WHEN a developer provides valid API credentials, THE SDK SHALL initialize successfully and store credentials securely
2. WHEN a developer provides invalid API credentials, THE SDK SHALL return a clear authentication error
3. THE SDK SHALL support environment configuration (production, sandbox, testnet)
4. WHEN credentials expire, THE SDK SHALL automatically refresh tokens if refresh token is available
5. THE SDK SHALL validate API key format before making network requests

---

### Requirement 2: 多币种支持

**User Story:** As a merchant, I want to accept multiple cryptocurrencies, so that I can serve customers with different crypto holdings.

#### Acceptance Criteria

1. THE SDK SHALL support EVM stablecoins: USDC, USDT, DAI on all supported EVM chains
2. THE SDK SHALL support native tokens: ETH, MATIC, BNB on respective chains
3. THE SDK SHALL support Solana tokens: SOL, USDC-SPL
4. THE SDK SHALL support Bitcoin (BTC) via Lightning Network or on-chain
5. WHEN a token is specified, THE SDK SHALL validate it is supported on the selected chain
6. THE SDK SHALL provide real-time price conversion between tokens and fiat currencies
7. THE SDK SHALL support automatic token detection based on payer's wallet

---

### Requirement 3: 多链支持

**User Story:** As a merchant, I want to accept payments on multiple blockchains, so that I can maximize my customer reach.

#### Acceptance Criteria

1. THE SDK SHALL support Ethereum Mainnet (chainId: 1)
2. THE SDK SHALL support Polygon (chainId: 137)
3. THE SDK SHALL support Base (chainId: 8453)
4. THE SDK SHALL support Arbitrum (chainId: 42161)
5. THE SDK SHALL support Optimism (chainId: 10)
6. THE SDK SHALL support BSC (chainId: 56)
7. THE SDK SHALL support Solana Mainnet
8. THE SDK SHALL support Bitcoin Mainnet
9. WHEN merchant specifies preferred chains, THE SDK SHALL only show those options to payers
10. THE SDK SHALL automatically detect payer's connected chain and suggest optimal payment path

---

### Requirement 4: 支付链接生成

**User Story:** As a merchant, I want to generate signed payment links, so that I can share them with customers for payment collection.

#### Acceptance Criteria

1. WHEN a merchant provides recipient address, amount, and token, THE Payment_Link_Generator SHALL create a cryptographically signed payment link
2. WHEN generating a payment link, THE SDK SHALL validate the recipient address format based on chain type
3. WHEN generating a payment link, THE SDK SHALL validate the amount is positive and within limits (max 1 billion)
4. THE SDK SHALL support configurable link expiry time (1 hour to 7 days)
5. WHEN a payment link is generated, THE SDK SHALL include HMAC signature for tamper detection
6. THE SDK SHALL support optional memo/reference/orderId field in payment links
7. WHEN token is not specified, THE SDK SHALL default to USDC
8. THE SDK SHALL support multi-chain payment links that allow payer to choose chain

---

### Requirement 5: QR 码生成

**User Story:** As a merchant, I want to generate QR codes from payment links, so that customers can scan and pay easily.

#### Acceptance Criteria

1. WHEN a valid payment link is provided, THE QR_Code_Generator SHALL create a scannable QR code
2. THE QR_Code_Generator SHALL support configurable QR code size (100px to 1000px)
3. THE QR_Code_Generator SHALL support multiple output formats (SVG, PNG, Base64)
4. WHEN generating QR code, THE SDK SHALL use high error correction level (H) for reliability
5. THE QR_Code_Generator SHALL include optional logo embedding in center
6. THE SDK SHALL support dynamic QR codes that update with payment status

---

### Requirement 6: 嵌入式收款组件 (Checkout Widget)

**User Story:** As a merchant, I want an embeddable checkout widget, so that I can easily add crypto payments to my website without complex integration.

#### Acceptance Criteria

1. THE SDK SHALL provide a pre-built Checkout_Widget that can be embedded with a single script tag
2. THE Checkout_Widget SHALL display supported tokens and chains for payer selection
3. THE Checkout_Widget SHALL integrate wallet connection (MetaMask, WalletConnect, Phantom, etc.)
4. THE Checkout_Widget SHALL show real-time payment status and confirmation
5. THE Checkout_Widget SHALL be customizable (colors, logo, language)
6. THE Checkout_Widget SHALL be responsive and work on mobile devices
7. WHEN payment is completed, THE Checkout_Widget SHALL call merchant's callback URL
8. THE Checkout_Widget SHALL support iframe embedding for maximum compatibility
9. THE SDK SHALL provide React, Vue, and vanilla JS versions of the widget

---

### Requirement 7: 一键支付按钮 (Payment Button)

**User Story:** As a merchant, I want a simple payment button, so that I can add crypto payments with minimal code.

#### Acceptance Criteria

1. THE SDK SHALL provide a Payment_Button component that triggers checkout flow
2. THE Payment_Button SHALL be configurable with amount, token, and recipient
3. THE Payment_Button SHALL support multiple styles (default, minimal, branded)
4. WHEN clicked, THE Payment_Button SHALL open the Checkout_Widget in a modal
5. THE Payment_Button SHALL show payment status (pending, success, failed)
6. THE SDK SHALL provide HTML snippet for non-JavaScript websites

---

### Requirement 8: 支付链接验证

**User Story:** As a merchant, I want to verify payment link integrity, so that I can detect tampering before processing payments.

#### Acceptance Criteria

1. WHEN a payment link is provided, THE Link_Verifier SHALL validate the HMAC signature
2. WHEN a payment link has expired, THE Link_Verifier SHALL return expiry error
3. WHEN a payment link contains invalid parameters, THE Link_Verifier SHALL identify tampered fields
4. THE Link_Verifier SHALL detect homoglyph attacks in addresses (Cyrillic character substitution)
5. WHEN verification succeeds, THE Link_Verifier SHALL return parsed payment parameters

---

### Requirement 9: 支付状态查询

**User Story:** As a merchant, I want to query payment status, so that I can track whether customers have completed payments.

#### Acceptance Criteria

1. WHEN a payment ID is provided, THE Status_Query SHALL return current payment status
2. THE Status_Query SHALL return transaction hash when payment is completed
3. THE Status_Query SHALL return fee breakdown for completed payments
4. WHEN payment is pending, THE Status_Query SHALL return estimated completion time
5. THE SDK SHALL support polling with configurable interval (minimum 5 seconds)
6. THE SDK SHALL support real-time status updates via WebSocket

---

### Requirement 10: Webhook 集成

**User Story:** As a merchant, I want to receive webhook notifications, so that I can process payments asynchronously without polling.

#### Acceptance Criteria

1. THE SDK SHALL provide webhook signature verification utility
2. WHEN a webhook is received, THE Webhook_Verifier SHALL validate the signature using shared secret
3. THE SDK SHALL provide typed webhook event parsing for payment.completed, payment.failed, payment.expired events
4. WHEN webhook verification fails, THE Webhook_Verifier SHALL return detailed error information
5. THE SDK SHALL support webhook retry acknowledgment

---

### Requirement 11: x402 Gasless 支付

**User Story:** As a developer, I want to integrate x402 gasless payments, so that payers don't need ETH for gas fees.

#### Acceptance Criteria

1. WHEN initiating x402 payment, THE SDK SHALL generate EIP-712 typed data for signing
2. THE SDK SHALL support USDC token for gasless payments on supported chains
3. WHEN user signs authorization, THE SDK SHALL submit to Relayer for execution
4. THE SDK SHALL track authorization status (pending, submitted, executed, failed)
5. WHEN authorization expires (1 hour), THE SDK SHALL return expiry error
6. THE SDK SHALL manage nonce to prevent replay attacks

---

### Requirement 12: 批量支付集成

**User Story:** As an enterprise user, I want to initiate batch payments via SDK, so that I can automate payroll and vendor payments.

#### Acceptance Criteria

1. THE SDK SHALL accept array of payment recipients with address, amount, token
2. WHEN batch is submitted, THE SDK SHALL validate all recipients before processing
3. THE SDK SHALL return batch ID for tracking
4. THE SDK SHALL support batch status polling
5. WHEN batch contains errors, THE SDK SHALL return detailed validation errors per recipient
6. THE SDK SHALL support batch size up to 500 recipients

---

### Requirement 13: 快速部署

**User Story:** As a merchant, I want to deploy crypto payments in minutes, so that I can start accepting payments without complex setup.

#### Acceptance Criteria

1. THE SDK SHALL provide a hosted checkout page that works without any code
2. THE SDK SHALL support no-code integration via dashboard-generated payment links
3. THE SDK SHALL provide copy-paste HTML snippets for basic integration
4. THE SDK SHALL support Shopify, WooCommerce, WordPress plugins
5. WHEN using hosted checkout, THE Merchant SHALL only need to configure API key and wallet address
6. THE SDK SHALL provide sandbox environment for testing without real funds

---

### Requirement 14: 错误处理

**User Story:** As a developer, I want clear error messages and codes, so that I can handle failures gracefully in my application.

#### Acceptance Criteria

1. THE SDK SHALL use consistent error code format (e.g., PB_AUTH_001, PB_PAYMENT_002)
2. WHEN network error occurs, THE SDK SHALL provide retry guidance
3. THE SDK SHALL distinguish between client errors (4xx) and server errors (5xx)
4. WHEN rate limit is exceeded, THE SDK SHALL return retry-after duration
5. THE SDK SHALL provide error localization support (English, Chinese)

---

### Requirement 15: 多语言支持

**User Story:** As a developer, I want SDK available in my preferred language, so that I can integrate easily with my tech stack.

#### Acceptance Criteria

1. THE SDK SHALL be available in TypeScript/JavaScript with full type definitions
2. THE SDK SHALL be available in Python with type hints
3. THE SDK SHALL be available in Go with idiomatic patterns
4. WHEN using TypeScript SDK, THE SDK SHALL support both CommonJS and ESM modules
5. THE SDK SHALL provide consistent API across all language implementations
6. THE SDK SHALL provide React hooks for easy frontend integration

---

### Requirement 16: 安全性

**User Story:** As a merchant, I want secure SDK implementation, so that my customers' payment data is protected.

#### Acceptance Criteria

1. THE SDK SHALL never log sensitive data (API keys, signatures, private keys)
2. THE SDK SHALL use HTTPS for all API communications
3. THE SDK SHALL validate SSL certificates
4. WHEN storing credentials, THE SDK SHALL use secure storage mechanisms
5. THE SDK SHALL support API key rotation without downtime

---

### Requirement 17: 文档与示例

**User Story:** As a developer, I want comprehensive documentation, so that I can integrate the SDK quickly and correctly.

#### Acceptance Criteria

1. THE SDK SHALL include README with quick start guide
2. THE SDK SHALL include API reference documentation for all public methods
3. THE SDK SHALL include code examples for common use cases
4. THE SDK SHALL include integration guides for popular frameworks (Next.js, Express, FastAPI, Gin)
5. THE SDK SHALL include troubleshooting guide for common errors
6. THE SDK SHALL include video tutorials for basic integration
7. THE SDK SHALL provide interactive API playground

