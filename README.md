# Protocol Bank

**The Enterprise-Grade Crypto Payment Orchestration Layer**

Protocol Bank is a comprehensive financial dashboard designed for modern enterprises to manage crypto payments, visualize entity networks, and orchestrate complex batch transactions across multiple chains (Ethereum, Solana, Bitcoin) with professional-grade analytics.

![Dashboard Preview](/dashboard-preview.png)

## 🚀 Key Features

### 1. **Multi-Chain Wallet Support**
   - **Unified Interface**: Connect MetaMask (EVM), Phantom (Solana), and Unisat (Bitcoin) simultaneously.
   - **Real-time Balances**: Aggregated view of your assets across all connected networks.
   - **Smart Routing**: Automatically selects the correct wallet provider based on the target network.

### 2. **Advanced Batch Payments & x402 Protocol**
   - **Mixed-Token Batches**: Send USDT, USDC, and DAI to multiple recipients in a single session.
   - **x402 Protocol / ERC-3009**: Implements the *TransferWithAuthorization* standard for gasless, delegated USDC payments. This allows AI agents and automated systems to propose payments that are signed securely by treasury managers off-chain.
   - **Multi-Chain Dispatch**: Orchestrate payments across Ethereum, Solana, and Bitcoin from a single CSV or form input.

### 3. **Entity Network Visualization (Wallet Tags)**
   - **Interactive Graph**: Visualize your payment flows with a professional, "Sector Space" inspired network graph.
   - **Hierarchy Management**: Organize vendors into Subsidiaries, Partners, and Suppliers.
   - **Flow Animation**: Real-time particle visualization of payment streams.
   - **Deep Analytics**: Drill down into specific entities to see lifetime value, transaction volume, and health scores.

### 4. **Financial Intelligence**
   - **Burn Rate & Runway**: Automatic calculation of monthly burn and estimated runway based on wallet balances.
   - **Expense Categorization**: Smart tagging of transactions (Infrastructure, Payroll, Marketing).
   - **Cross-Source History**: Merges on-chain data (Etherscan) with off-chain metadata (Supabase) for a complete financial audit trail.

## 🛠 Technical Architecture

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Visualization**: Recharts, Framer Motion, Custom SVG Graph
- **Web3 Integration**: ethers.js (v6), Solana Web3 (Adapter), Bitcoin/Unisat API
- **Payment Standards**: 
  - **ERC-20**: Standard Token Transfers
  - **ERC-3009**: Transfer With Authorization (x402 Protocol)
  - **EIP-712**: Typed Data Signing for secure approvals
- **Data Layer**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Indexer**: Etherscan API Integration

## 🔒 Security & Privacy

- **Client-Side Execution**: Private keys never leave your local wallet. All transactions are signed locally.
- **Data Segregation**: The application filters all data by the connected wallet address.
- **Transparent Logic**: Open-source code allows for full auditing of payment routing logic.

## 📄 Whitepaper

For a deep dive into the economic model, market analysis, and technical implementation of the x402 protocol, please read the complete [Whitepaper](WHITEPAPER.md).

## 🏁 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ETHERSCAN_API_KEY` (Optional)
4. **Run Development Server**: `npm run dev`

---

V1.1
Technical Whitepaper: ProtocolBanks Architecture
Title: A Non-Custodial Decentralized Banking Infrastructure with Integrated Fiat-to-Crypto Solutions

1. Executive Summary 
ProtocolBanks is a decentralized neo-banking protocol designed to bridge traditional fiat systems with on-chain finance. By leveraging ERC-4337 (Account Abstraction) and strategic partnerships with liquidity gateways like Transak, ProtocolBanks provides a secure, non-custodial environment where users retain full control over their assets while enjoying the convenience of traditional banking services, such as debit cards and real-time payments.

2. Core Infrastructure
The platform is built on three specialized layers:

A. User Interface & Integration Layer
Transak Gateway Integration: Utilizing Transak’s White-label API to provide seamless fiat on-ramp/off-ramp services directly within the application.

Security: Users interact with the protocol via social login or hardware wallets, with no private keys stored on ProtocolBanks servers.

B. Smart Account Layer (The "Vault")
ERC-4337 Account Abstraction: Every user is assigned a programmable Smart Contract Wallet (SCW).

Spending Limit Module: A core security feature that allows users to define "Pre-authorized" spending limits. This ensures that only a specific portion of the funds is accessible for daily card transactions, while the majority remains secured in the vault.

C. Payment Execution Layer
Auth-Forwarding Logic: When a user initiates a transaction via a linked crypto-card, the payment network triggers a real-time Webhook. ProtocolBanks verifies the on-chain balance and the pre-defined spending limits before approving the transaction.

3. Transaction Workflow
Direct Deposit (Fiat to On-chain): Users initiate a purchase via Transak. Funds are settled directly to the user’s Safe {Core} address. ProtocolBanks acts as the interface, ensuring zero-custody risk.

Real-time Pre-authorization: When a linked Visa/Mastercard is swiped, the system checks the "Locked" vs "Available" balance within the user's Smart Account.

Settlement: The protocol executes an automated swap and transfer only for the authorized amount, leaving the remaining user funds untouched and secured on the blockchain.

4. Revenue Model & Sustainability
Transaction Mark-up: A transparent service fee (0.2%-0.5%) added to fiat-crypto conversions.

SaaS & Premium Tiers: Subscription-based models for institutional users and high-net-worth individuals requiring advanced multi-sig banking features.

Interoperability Fees: Commissions from cross-chain liquidity routing and DeFi yield aggregation.

5. Compliance & Security 
Non-Custodial Nature: ProtocolBanks never assumes custody of user funds, significantly reducing regulatory hurdles and enhancing user trust.

AML/KYC Integration: Fiat-related compliance is handled through Transak’s fully licensed KYC/AML engine, ensuring all on-ramp activities meet global regulatory standards.

*Note: This project is a production-ready demo. For the "Entity Network" visualization, a simulation mode is active for unauthenticated users to demonstrate the platform's capabilities at scale.*
