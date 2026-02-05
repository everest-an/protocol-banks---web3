# Reown AppKit Integration Guide

This guide explains how to use the Reown AppKit integration for email/social login and fiat on-ramp features.

## What is Reown?

Reown (formerly WalletConnect) AppKit is an all-in-one SDK that enables:

- **Email Login**: Users can create crypto wallets using just their email address (no browser extensions needed)
- **Social Login**: Login with Google, Twitter, GitHub, Discord, Apple, or Facebook
- **Multi-Wallet Support**: Connect with MetaMask, Rainbow, Coinbase Wallet, Trust Wallet, and 300+ others
- **Fiat On-Ramp**: Buy cryptocurrency with credit cards or bank transfers
- **Mobile Support**: Works seamlessly on iOS and Android devices

## User Experience

### For Users Without Crypto Wallets

1. **Click "Start Now"** on the landing page to open the wallet connection modal
2. **Enter email address** or choose a social login provider
3. **Verify via email** (receive verification code)
4. **Wallet created automatically** - users get an Ethereum address without installing anything
5. **Buy crypto** - users can purchase USDT/USDC with credit card directly in the app

### For Users With Existing Wallets

1. **Click "Wallet"** button to connect existing wallet
2. **Choose wallet** (MetaMask, Rainbow, Coinbase, etc.)
3. **Approve connection** in wallet extension/app
4. **Start using** - full access to Protocol Banks features

## Configuration

### Environment Variable

Add this to your `.env` or Vars section:

```env
NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id_here
```

Get your Project ID from: https://cloud.reown.com

### Important: Remote Dashboard Configuration

**Note**: You may see this notice in the browser console:

```env
[Reown Config Notice] Your local configuration for "features.email", "features.socials", "features.onramp" was ignored because a remote configuration was successfully fetched.
```

**This is expected behavior.** Reown AppKit manages features (email login, social logins, fiat on-ramp) through the remote dashboard at https://dashboard.reown.com, not through local code configuration. This provides centralized control over features across all deployments.

To enable features:

1. Visit https://dashboard.reown.com
2. Select your project
3. Navigate to "Features" section
4. Enable/disable:
   - Email authentication
   - Social login providers (Google, Twitter, GitHub, Discord, Apple, Facebook)
   - Fiat on-ramp providers (Coinbase Pay, MoonPay, Transak, Ramp Network)
5. Save changes

The AppKit will automatically fetch and apply your dashboard settings. No code changes are needed.

### Supported Networks

Currently configured for:
- Ethereum Mainnet (Chain ID: 1)
- Sepolia Testnet (Chain ID: 11155111)
- Base (Chain ID: 8453)

## Features

### 1. Email Login

Users can create wallets with just an email:

```
User Flow:
1. Click "Email / Social Login"
2. Enter email: user@example.com
3. Receive verification code via email
4. Enter code
5. Wallet address generated: 0xabc...123
```

**Benefits**:
- No browser extension required
- Works on mobile devices
- Familiar login experience
- Secure (non-custodial, keys stored encrypted)

### 2. Social Login

Supported platforms:
- Google
- Twitter (X)
- GitHub
- Discord
- Apple
- Facebook

Users can sign in with their existing social accounts.

### 3. Fiat On-Ramp

Users can buy crypto without leaving the app:

```
Supported Payment Methods:
- Credit/Debit cards (Visa, Mastercard)
- Bank transfers (ACH, SEPA)
- Apple Pay
- Google Pay
```

**Supported Providers**:
- Coinbase Pay
- MoonPay
- Transak
- Ramp Network

**Supported Cryptocurrencies**:
- USDT (Tether)
- USDC (USD Coin)
- ETH (Ethereum)
- And more...

### 4. Multi-Wallet Support

Connect with any wallet:
- MetaMask
- Rainbow
- Coinbase Wallet
- Trust Wallet
- Ledger
- WalletConnect-compatible wallets (300+)

## Usage in Code

### Open Connection Modal

```typescript
import { useAppKit } from '@reown/appkit/react'

function MyComponent() {
  const { open } = useAppKit()
  
  // Open default connection modal
  open()
  
  // Open specific views
  open({ view: 'Connect' })        // Wallet selection
  open({ view: 'Account' })        // Account details
  open({ view: 'OnRampProviders' }) // Buy crypto
}
```

### Access User Account

```typescript
import { useAppKitAccount } from '@reown/appkit/react'

function MyComponent() {
  const { address, isConnected, caipAddress } = useAppKitAccount()
  
  if (isConnected) {
    console.log('User address:', address)
  }
}
```

### Access Wallet Provider

```typescript
import { useAppKitProvider } from '@reown/appkit/react'

function MyComponent() {
  const { walletProvider } = useAppKitProvider('eip155')
  
  // Use provider to send transactions
  const signer = await walletProvider.getSigner()
}
```

## Security

### Non-Custodial

- Users control their private keys
- Keys are encrypted and stored securely
- Reown cannot access user funds

### Email Login Security

- Email verification required
- 2FA available (optional)
- Keys encrypted with user password
- Backup options available

### Best Practices

1. **Always verify transactions** before signing
2. **Check recipient addresses** in payment flows
3. **Enable 2FA** for email logins (recommended)
4. **Backup wallet** using recovery phrase
5. **Use hardware wallets** for large amounts

## User Benefits

| Feature | Traditional Wallet | Reown AppKit |
|---------|-------------------|--------------|
| **Setup Time** | 5-10 minutes | 30 seconds |
| **Browser Extension** | Required | Not required |
| **Mobile Support** | Limited | Full support |
| **Social Login** | No | Yes |
| **Buy Crypto** | External | Built-in |
| **Seed Phrase** | Required | Optional |

## Business Benefits

1. **Lower Barrier to Entry**: Users don't need existing wallets
2. **Higher Conversion**: Email login = familiar UX
3. **Mobile-First**: Works perfectly on smartphones
4. **Integrated On-Ramp**: Users can buy crypto in-app
5. **Global Reach**: Supports 100+ countries

## Troubleshooting

### Email Verification Not Arriving

- Check spam folder
- Verify email address is correct
- Wait 2-3 minutes (may be delayed)
- Try resending verification code

### Fiat On-Ramp Not Working

- Verify your region is supported
- Check payment method is available
- Ensure KYC requirements are met
- Try different on-ramp provider

### Wallet Not Connecting

- Check network connection
- Verify `NEXT_PUBLIC_REOWN_PROJECT_ID` is set
- Try clearing browser cache
- Check Reown project is active

## Resources

- Reown Documentation: https://docs.reown.com
- Reown Dashboard: https://cloud.reown.com
- Support: https://reown.com/support
- Status Page: https://status.reown.com

## Next Steps

1. **Set up Reown Project** at https://cloud.reown.com
2. **Add Project ID** to environment variables
3. **Test email login** in development
4. **Configure branding** in Reown dashboard
5. **Enable on-ramp providers** for fiat purchases
6. **Deploy to production** and test with real users
