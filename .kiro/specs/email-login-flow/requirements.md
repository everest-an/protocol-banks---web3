# Requirements Document

## Introduction

邮箱登录完整流程是 ProtocolBanks 的核心用户 onboarding 功能。该功能允许个人用户通过邮箱地址完成身份验证、PIN 设置、加密钱包创建，并建立账户与钱包的关联关系。这是 Web2 用户进入 Web3 的关键入口。

## Glossary

- **Auth_System**: 认证系统，管理用户身份和会话
- **Email_Verifier**: 邮箱验证器，处理 Magic Link 发送和验证
- **Wallet_Creator**: 钱包创建器，生成 Shamir 分片和钱包地址
- **Account_Validator**: 账户验证器，检查账户完整性和关联性
- **Session_Manager**: 会话管理器，管理用户登录状态
- **Magic_Link**: 魔法链接，用于无密码登录的一次性链接
- **Shamir_Shares**: Shamir 分片，将私钥分成 3 份 (2-of-3 阈值)

## Requirements

### Requirement 1: 邮箱验证与 Magic Link

**User Story:** As a new user, I want to log in using only my email address, so that I can access ProtocolBanks without remembering a password.

#### Acceptance Criteria

1. WHEN a user enters their email, THE Email_Verifier SHALL send a Magic Link to that email address
2. THE Magic Link SHALL contain a cryptographically secure token (32+ bytes of randomness)
3. THE Magic Link SHALL expire after 15 minutes
4. WHEN a user clicks the Magic Link, THE Auth_System SHALL verify the token and create a session
5. IF the Magic Link is used twice, THEN THE Auth_System SHALL reject the second attempt
6. IF the Magic Link expires, THEN THE Auth_System SHALL require the user to request a new one
7. THE Email_Verifier SHALL rate limit Magic Link requests (max 3 per email per hour)
8. WHEN a Magic Link is verified, THE Auth_System SHALL create an auth_users record with email and status='pending_wallet'

### Requirement 2: PIN 设置与 Shamir 分片生成

**User Story:** As a user, I want to set a PIN to protect my wallet, so that my private key is secure even if my device is compromised.

#### Acceptance Criteria

1. WHEN a user verifies their email, THE Auth_System SHALL prompt for PIN setup
2. THE Auth_System SHALL require a 6-digit PIN (000000-999999)
3. THE Auth_System SHALL validate PIN strength (no sequential numbers like 123456)
4. WHEN a user sets a PIN, THE Wallet_Creator SHALL generate Shamir shares using 2-of-3 threshold
5. THE Wallet_Creator SHALL encrypt Share A (device) with PIN-derived key using AES-256-GCM
6. THE Wallet_Creator SHALL encrypt Share B (server) with PIN-derived key using AES-256-GCM
7. THE Wallet_Creator SHALL generate Share C (recovery phrase) as 12-word BIP39 mnemonic
8. WHEN PIN setup completes, THE Auth_System SHALL update auth_users status to 'pin_set'

### Requirement 3: 钱包创建与地址生成

**User Story:** As a user, I want my wallet to be created automatically, so that I can start using ProtocolBanks immediately.

#### Acceptance Criteria

1. WHEN a user completes PIN setup, THE Wallet_Creator SHALL generate a new Ethereum address
2. THE Wallet_Creator SHALL derive the address from the reconstructed private key
3. THE Wallet_Creator SHALL store the public key in embedded_wallets table
4. THE Wallet_Creator SHALL NOT store the private key anywhere
5. WHEN wallet creation completes, THE Auth_System SHALL update auth_users status to 'wallet_created'
6. THE Wallet_Creator SHALL support multi-chain wallet generation (Ethereum, Polygon, Solana)
7. WHEN wallet is created, THE Auth_System SHALL emit a 'wallet_created' event for monitoring

### Requirement 4: 账户与钱包关联验证

**User Story:** As a system, I want to ensure every user account is properly linked to a wallet, so that there are no orphaned accounts or wallets.

#### Acceptance Criteria

1. WHEN a user completes the login flow, THE Account_Validator SHALL verify the relationship between auth_users and embedded_wallets
2. THE Account_Validator SHALL check that user_id in embedded_wallets matches the auth_users.id
3. THE Account_Validator SHALL check that wallet_address is not null and is a valid Ethereum address
4. IF any relationship is invalid, THEN THE Account_Validator SHALL raise an error and prevent login
5. THE Account_Validator SHALL create an audit log entry for each account validation
6. WHEN validation passes, THE Auth_System SHALL set auth_users status to 'active'
7. THE Account_Validator SHALL run validation on every login to detect data corruption

### Requirement 5: 会话创建与状态管理

**User Story:** As a user, I want to stay logged in across page refreshes, so that I don't have to re-authenticate constantly.

#### Acceptance Criteria

1. WHEN account validation passes, THE Session_Manager SHALL create an HTTP-only session cookie
2. THE Session_Manager SHALL set session expiration to 30 days
3. THE Session_Manager SHALL store session_id in auth_sessions table with user_id and wallet_address
4. WHEN a user navigates to a protected page, THE Session_Manager SHALL verify the session is valid
5. IF session is expired, THEN THE Auth_System SHALL redirect to login page
6. WHEN a user logs out, THE Session_Manager SHALL invalidate the session immediately
7. THE Session_Manager SHALL support session binding (device fingerprinting) to prevent session hijacking

### Requirement 6: 错误处理与恢复流程

**User Story:** As a user, I want clear error messages and recovery options, so that I can resolve issues without contacting support.

#### Acceptance Criteria

1. IF email verification fails, THEN THE Auth_System SHALL display specific error (invalid email, already registered, etc.)
2. IF PIN setup fails, THEN THE Auth_System SHALL allow retry with clear guidance
3. IF wallet creation fails, THEN THE Auth_System SHALL provide recovery options (retry, contact support)
4. IF account validation fails, THEN THE Auth_System SHALL log the error and notify the user
5. WHEN a user loses their PIN, THE Auth_System SHALL allow recovery using Share C (recovery phrase)
6. WHEN a user loses their recovery phrase, THE Auth_System SHALL allow recovery via email verification
7. THE Auth_System SHALL provide clear error messages in user's preferred language

### Requirement 7: 完整性检查与数据一致性

**User Story:** As an operator, I want to ensure data integrity throughout the login flow, so that there are no inconsistencies or data loss.

#### Acceptance Criteria

1. THE Auth_System SHALL use database transactions to ensure atomicity of account creation
2. IF any step fails, THE Auth_System SHALL rollback all changes to maintain consistency
3. THE Auth_System SHALL validate all data before storing (email format, address format, etc.)
4. WHEN a user completes login, THE Auth_System SHALL verify all required fields are populated
5. THE Auth_System SHALL maintain referential integrity between auth_users and embedded_wallets
6. THE Auth_System SHALL log all state transitions for audit purposes
7. THE Auth_System SHALL support data recovery in case of partial failures

### Requirement 8: 安全性与防护

**User Story:** As a security officer, I want robust protections against attacks, so that user accounts and funds are safe.

#### Acceptance Criteria

1. THE Email_Verifier SHALL validate email format and check for disposable email addresses
2. THE Auth_System SHALL implement CSRF protection on all forms
3. THE Auth_System SHALL use HTTPS for all communications
4. THE Wallet_Creator SHALL never log or expose private key material
5. THE Auth_System SHALL implement rate limiting on login attempts (max 5 per IP per hour)
6. THE Auth_System SHALL detect and block suspicious patterns (rapid account creation, etc.)
7. THE Auth_System SHALL support 2FA (two-factor authentication) as optional enhancement

