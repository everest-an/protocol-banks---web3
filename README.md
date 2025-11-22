# Protocol Bank

**The Enterprise-Grade Crypto Payment Orchestration Layer**

Protocol Bank is a comprehensive financial dashboard designed for modern enterprises to manage crypto payments, visualize entity networks, and orchestrate complex batch transactions across multiple chains (Ethereum, Solana, Bitcoin) with professional-grade analytics.

![Dashboard Preview](/dashboard-preview.png)

## 🚀 Key Features

### 1. **Multi-Chain Wallet Support**
   - **Unified Interface**: Connect MetaMask (EVM), Phantom (Solana), and Unisat (Bitcoin) simultaneously.
   - **Real-time Balances**: Aggregated view of your assets across all connected networks.
   - **Smart Routing**: Automatically selects the correct wallet provider based on the target network.

### 2. **Advanced Batch Payments**
   - **Mixed-Token Batches**: Send USDT, USDC, and DAI to multiple recipients in a single session.
   - **x402 Protocol Integration**: Support for ERC-3009 (TransferWithAuthorization) for gas-optimized, delegated USDC payments.
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
- **Web3 Integration**: ethers.js, Solana Web3 (Adapter), Bitcoin/Unisat API
- **Data Layer**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Indexer**: Etherscan API Integration

## 🔒 Security & Privacy

- **Client-Side Execution**: Private keys never leave your local wallet. All transactions are signed locally.
- **Data Segregation**: The application filters all data by the connected wallet address.
- **Transparent Logic**: Open-source code allows for full auditing of payment routing logic.

## 📄 Whitepaper Abstract

**Protocol Bank: Decentralized Treasury Management for the AI Era**

*Abstract*: As decentralized organizations (DAOs) and AI agents become economic actors, the need for a programmable, cross-chain treasury management layer becomes critical. Protocol Bank proposes a unified interface for "Entity Resource Planning" (ERP) on the blockchain. By abstracting chain-specific complexities and integrating standard accounting practices (tags, categories, reports) directly with on-chain events, Protocol Bank enables seamless financial operations for the next generation of digital enterprises. Our "x402" standard extension allows for gasless, delegated settlements, paving the way for autonomous agent payments.

## 🏁 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ETHERSCAN_API_KEY` (Optional)
4. **Run Development Server**: `npm run dev`

---

*Note: This project is a production-ready demo. For the "Entity Network" visualization, a simulation mode is active for unauthenticated users to demonstrate the platform's capabilities at scale.*
