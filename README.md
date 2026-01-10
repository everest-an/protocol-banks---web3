# Protocol Banks

**The Enterprise-Grade Omnichain Banking Infrastructure**

Protocol Banks is a comprehensive digital banking platform designed for modern enterprises and individuals to manage crypto payments, cross-chain swaps, batch transactions, and financial analytics across multiple blockchains including Ethereum, Bitcoin, Solana, and ZetaChain.


## Key Features

### 1. **Dual User Experience (Web2 & Web3)**
   - **Web2 Mode**: Simplified interface with friendly terminology for traditional users
   - **Web3 Mode**: Professional interface with full technical details for crypto-native users
   - **Automatic Detection**: Smart detection based on wallet connection method

### 2. **Email & Social Login (Reown AppKit)**
   - **No Wallet Required**: Users can create crypto wallets using just their email or social accounts
   - **Social Login Support**: Google, Twitter, GitHub, Discord, Apple, Facebook
   - **Fiat On-Ramp**: Buy cryptocurrency with credit cards or bank transfers
   - **Non-Custodial**: Users control their private keys securely

### 3. **Omnichain Banking (ZetaChain Integration)**
   - **Universal Smart Contracts**: Single address manages assets across all chains
   - **Native Bitcoin Support**: Direct BTC deposits via TSS addresses
   - **Cross-Chain Transfers**: Move assets between chains without traditional bridges
   - **ZRC-20 Standard**: Unified token standard across all connected chains

### 4. **Professional Cross-Chain Swap (Rango Exchange)**
   - **Multi-Route Discovery**: Compare routes from 100+ DEXs and 20+ bridges
   - **Best Price Selection**: Automatic selection of optimal swap routes
   - **Web3 View**: Full route details, fees, time estimates, path visualization
   - **Web2 View**: Simplified one-click exchange with auto-optimized routing
   - **10+ Chains Supported**: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche, ZetaChain, Solana, Bitcoin

### 5. **Advanced Batch Payments & x402 Protocol**
   - **Mixed-Token Batches**: Send USDT, USDC, and DAI to multiple recipients
   - **ERC-3009 / x402 Protocol**: Gasless, delegated payments with TransferWithAuthorization
   - **CCTP Cross-Chain**: Circle's Cross-Chain Transfer Protocol for native USDC bridging
   - **Draft Saving**: Save batch payment drafts locally to prevent data loss
   - **Total Amount Preview**: Clear confirmation of total payment before execution

### 6. **Payment Links & QR Codes**
   - **x402 Signed Links**: Cryptographically signed payment request URLs
   - **QR Code Generation**: Scannable QR codes for easy mobile payments
   - **Clipboard Protection**: Built-in protection against address hijacking

### 7. **Entity Network Visualization (Wallet Tags)**
   - **Interactive Graph**: "Sector Space" inspired network visualization
   - **Hierarchy Management**: Organize vendors into Subsidiaries, Partners, Suppliers
   - **Edit/Delete Support**: Full CRUD operations on vendor records
   - **Payment Flow Animation**: Real-time particle visualization of payment streams

### 8. **Financial Intelligence & Analytics**
   - **Burn Rate & Runway**: Automatic calculation based on wallet balances
   - **Expense Categorization**: Smart tagging (Infrastructure, Payroll, Marketing)
   - **Transaction History**: Unified view of all payments with filtering and export
   - **CSV/PDF Export**: Export financial reports for accounting

### 9. **Enterprise Features**
   - **Multi-Signature Wallets**: Safe (Gnosis Safe) protocol integration for team approvals
   - **API Key Management**: Generate API keys with granular permissions and rate limits
   - **Webhook Notifications**: Real-time event callbacks for system integration
   - **IP/Domain Whitelisting**: Restrict API access to authorized sources

### 10. **Security (52 Attack Protections)**
   - **Signature Phishing Protection**: Detects malicious signature requests
   - **Flash Loan Defense**: Monitors for flash loan attack patterns
   - **Address Poisoning Detection**: Identifies similar-looking malicious addresses
   - **MEV Protection**: Guards against front-running and sandwich attacks
   - **Audit Logging**: Complete audit trail of all security events
   - **Rate Limiting**: Protection against spam and abuse

### 11. **Admin Dashboard**
   - **System Configuration**: Environment variable status monitoring
   - **Contract Management**: Multi-chain contract deployment tracking
   - **Domain Whitelist**: Reown/Stripe/Resend domain configuration
   - **Monitoring & Alerts**: Real-time system health and security alerts
   - **Fee Configuration**: Protocol fee rates and tier settings

## Technical Architecture

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4
- **Wallet Integration**: 
  - **Reown AppKit**: Email/social login, fiat on-ramp, 300+ wallets
  - **ethers.js v6**: Ethereum interactions
  - **Solana Web3**: Solana wallet adapter
  - **Bitcoin/Unisat**: Bitcoin wallet integration
- **Cross-Chain**: 
  - **ZetaChain**: Universal smart contracts, ZRC-20 tokens
  - **Rango Exchange**: Multi-route cross-chain swaps
  - **Circle CCTP**: Native USDC bridging
- **Visualization**: Recharts, Framer Motion, Custom SVG Graph
- **Payment Standards**: 
  - **ERC-20**: Standard Token Transfers
  - **ERC-3009**: Transfer With Authorization (x402 Protocol)
  - **EIP-712**: Typed Data Signing
- **Data Layer**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Indexer**: Etherscan API Integration
- **Email Service**: Resend (custom domain support)
- **Security**: Google reCAPTCHA v3, 52 attack pattern protections

## Database Schema (23+ Tables)

| Category | Tables |
|----------|--------|
| **Payments** | payments, batch_payments, batch_payment_items |
| **Vendors** | vendors |
| **Fees** | protocol_fees, fee_collection_batches, fee_config, monthly_fee_summary |
| **Security** | audit_logs, security_alerts, detected_attack_patterns, used_nonces, rate_limits, session_bindings |
| **Enterprise** | multisig_wallets, multisig_signers, multisig_transactions, api_keys, webhooks, webhook_deliveries |
| **System** | system_config, contract_deployments, domain_whitelist, monitoring_alerts |

## Security & Privacy

- **Client-Side Execution**: Private keys never leave your local wallet
- **Non-Custodial**: Email login users control their own encrypted keys
- **Row Level Security**: All database queries filtered by wallet address
- **52 Attack Protections**: Comprehensive defense against known attack vectors
- **Audit Trail**: Complete logging of all sensitive operations

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Reown account (https://cloud.reown.com)
- Supabase account (https://supabase.com)
- (Optional) Rango API key for production cross-chain swaps

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/everest-an/protocol-banks---web3.git
   cd protocol-banks---web3
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   
   Copy `.env.example` to `.env.local` and configure:
   
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Reown AppKit
   NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
   
   # Rango Exchange (for cross-chain swaps)
   RANGO_API_KEY=your_rango_api_key
   
   # Etherscan
   ETHERSCAN_API_KEY=your_etherscan_api_key
   
   # reCAPTCHA
   RECAPTCHA_SITE_KEY=your_site_key
   RECAPTCHA_SECRET_KEY=your_secret_key
   
   # Resend
   RESEND_API_KEY=your_resend_api_key
   ```

4. **Set up Database**
   
   Run SQL scripts in `scripts/` folder in order (001-014)

5. **Run Development Server**
   ```bash
   npm run dev
   ```

## Page Structure

| Route | Description |
|-------|-------------|
| `/` | Dashboard - Account overview and quick actions |
| `/send` | Payment hub - Personal/Enterprise payment options |
| `/batch-payment` | Batch payments with CSV import |
| `/receive` | Payment links and QR codes |
| `/swap` | Cross-chain swap (Rango Exchange) |
| `/omnichain` | ZetaChain omnichain vault |
| `/history` | Transaction history with filters |
| `/vendors` | Wallet tags and vendor management |
| `/analytics` | Financial reports and charts |
| `/security` | Security dashboard and audit logs |
| `/fees` | Fee structure and history |
| `/settings/multisig` | Multi-signature wallet setup |
| `/settings/api-keys` | API key management |
| `/settings/webhooks` | Webhook configuration |
| `/admin` | Admin dashboard (system config) |

## Documentation

- [Environment Setup Guide](ENV_SETUP.md)
- [Reown Integration Guide](REOWN_SETUP.md)
- [Whitepaper](WHITEPAPER.md)

## Contact

- Email: everest9812@gmail.com
- Twitter: [@0xPrococolBank](https://x.com/0xPrococolBank)
- GitHub: [everest-an/protocol-banks---web3](https://github.com/everest-an/protocol-banks---web3)

## License

This project is open source and available under the MIT License.

---

**Note**: Cross-chain swap functionality is currently in test mode. Do not use real funds for Rango Exchange features until production API keys are configured.
