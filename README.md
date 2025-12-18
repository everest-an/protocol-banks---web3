# Protocol Bank

**The Enterprise-Grade Crypto Payment Orchestration Layer**

Protocol Bank is a comprehensive financial dashboard designed for modern enterprises to manage crypto payments, visualize entity networks, and orchestrate complex batch transactions across multiple chains (Ethereum, Solana, Bitcoin) with professional-grade analytics.

![Dashboard Preview](/dashboard-preview.png)

## 🚀 Key Features

### 1. **Email & Social Login (Reown AppKit)**
   - **No Wallet Required**: Users can create crypto wallets using just their email address or social accounts.
   - **Social Login Support**: Login with Google, Twitter, GitHub, Discord, Apple, or Facebook.
   - **Fiat On-Ramp**: Buy cryptocurrency with credit cards or bank transfers directly in the app.
   - **Mobile-Friendly**: Works seamlessly on iOS and Android without browser extensions.
   - **Non-Custodial**: Users control their private keys, which are securely encrypted.

### 2. **Multi-Chain Wallet Support**
   - **Unified Interface**: Connect MetaMask (EVM), Phantom (Solana), and Unisat (Bitcoin) simultaneously.
   - **Real-time Balances**: Aggregated view of your assets across all connected networks.
   - **Smart Routing**: Automatically selects the correct wallet provider based on the target network.
   - **300+ Wallets**: Support for MetaMask, Rainbow, Coinbase Wallet, Trust Wallet, and more via WalletConnect.

### 3. **Advanced Batch Payments & x402 Protocol**
   - **Mixed-Token Batches**: Send USDT, USDC, and DAI to multiple recipients in a single session.
   - **x402 Protocol / ERC-3009**: Implements the *TransferWithAuthorization* standard for gasless, delegated USDC payments. This allows AI agents and automated systems to propose payments that are signed securely by treasury managers off-chain.
   - **Multi-Chain Dispatch**: Orchestrate payments across Ethereum, Solana, and Bitcoin from a single CSV or form input.

### 4. **Entity Network Visualization (Wallet Tags)**
   - **Interactive Graph**: Visualize your payment flows with a professional, "Sector Space" inspired network graph.
   - **Hierarchy Management**: Organize vendors into Subsidiaries, Partners, and Suppliers.
   - **Flow Animation**: Real-time particle visualization of payment streams.
   - **Deep Analytics**: Drill down into specific entities to see lifetime value, transaction volume, and health scores.

### 5. **Financial Intelligence**
   - **Burn Rate & Runway**: Automatic calculation of monthly burn and estimated runway based on wallet balances.
   - **Expense Categorization**: Smart tagging of transactions (Infrastructure, Payroll, Marketing).
   - **Cross-Source History**: Merges on-chain data (Etherscan) with off-chain metadata (Supabase) for a complete financial audit trail.

## 🛠 Technical Architecture

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4
- **Wallet Integration**: 
  - **Reown AppKit**: Email/social login, fiat on-ramp, multi-wallet support
  - **ethers.js v6**: Ethereum interactions
  - **Solana Web3**: Solana wallet adapter
  - **Bitcoin/Unisat**: Bitcoin wallet integration
- **Visualization**: Recharts, Framer Motion, Custom SVG Graph
- **Payment Standards**: 
  - **ERC-20**: Standard Token Transfers
  - **ERC-3009**: Transfer With Authorization (x402 Protocol)
  - **EIP-712**: Typed Data Signing for secure approvals
- **Data Layer**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Indexer**: Etherscan API Integration
- **Email Service**: Resend (custom domain support)
- **Security**: Google reCAPTCHA v3 for form protection

## 🔒 Security & Privacy

- **Client-Side Execution**: Private keys never leave your local wallet. All transactions are signed locally.
- **Non-Custodial**: Email login users control their own keys (encrypted and stored securely).
- **Data Segregation**: The application filters all data by the connected wallet address.
- **Transparent Logic**: Open-source code allows for full auditing of payment routing logic.
- **Rate Limiting**: Protection against spam and abuse.
- **Input Validation**: All user inputs are sanitized and validated.

## 📄 Whitepaper

For a deep dive into the economic model, market analysis, and technical implementation of the x402 protocol, please read the complete [Whitepaper](WHITEPAPER.md).

## 🏁 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Reown account (https://cloud.reown.com)
- A Supabase account (https://supabase.com)
- (Optional) Resend account for email notifications

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
   
   Copy `.env.example` to `.env.local` and fill in your values:
   
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Reown AppKit (Required for Email/Social Login)
   NEXT_PUBLIC_REOWN_PROJECT_ID=your_reown_project_id
   
   # Etherscan (Optional)
   ETHERSCAN_API_KEY=your_etherscan_api_key
   
   # reCAPTCHA (for contact form)
   RECAPTCHA_SITE_KEY=your_site_key
   RECAPTCHA_SECRET_KEY=your_secret_key
   
   # Resend (for contact form emails)
   RESEND_API_KEY=your_resend_api_key
   ```

4. **Set up Supabase Database**
   
   Run the SQL scripts in the `scripts` folder in order:
   ```
   001_create_tables.sql
   002_create_indexes.sql
   003_create_policies.sql
   ...
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

6. **Open in Browser**
   
   Navigate to `http://localhost:3000`

### First-Time Setup

1. **Create Reown Project**:
   - Go to https://cloud.reown.com
   - Create a new project
   - Add your domain (localhost:3000 for development)
   - Copy the Project ID to your `.env.local`

2. **Test Email Login**:
   - Click "Email / Social Login" on homepage
   - Enter your email
   - Verify with the code sent to your inbox
   - Your wallet will be created automatically

3. **Buy Crypto (Optional)**:
   - After logging in, click your account dropdown
   - Select "Buy Crypto (Fiat On-Ramp)"
   - Purchase USDT or USDC with credit card

## 📱 Mobile Support (PWA)

Protocol Banks is a Progressive Web App (PWA) that can be installed on iOS and Android:

### iOS Installation
1. Open Safari and navigate to protocolbanks.com
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" to confirm

### Android Installation
1. Open Chrome and navigate to protocolbanks.com
2. Tap the three-dot menu
3. Select "Add to Home Screen"
4. Tap "Add" to confirm

Once installed, the app will open in fullscreen mode without browser UI.

## 🌐 Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Import your GitHub repository
   - Add environment variables in project settings
   - Deploy

3. **Update Reown Configuration**
   - Add your production domain to Reown project
   - Verify email domain for production emails

## 📚 Documentation

- [Environment Setup Guide](ENV_SETUP.md) - Complete guide for configuring all environment variables
- [Reown Integration Guide](REOWN_SETUP.md) - Detailed documentation for email/social login and fiat on-ramp
- [Whitepaper](WHITEPAPER.md) - Economic model and technical implementation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

- Email: everest9812@gmail.com
- Twitter: [@0xPrococolBank](https://x.com/0xPrococolBank)
- GitHub: [everest-an/protocol-banks---web3](https://github.com/everest-an/protocol-banks---web3)

## 📄 License

This project is open source and available under the MIT License.

---

*Note: This project is production-ready. For the "Entity Network" visualization, a simulation mode is active for unauthenticated users to demonstrate the platform's capabilities at scale.*
