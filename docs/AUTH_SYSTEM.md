# Protocol Banks - Custom Authentication System

## Overview

Protocol Banks uses a custom authentication system that provides Privy-like functionality with enhanced security through Shamir's Secret Sharing. This document describes the architecture, security model, and usage.

## Security Architecture

### Shamir's Secret Sharing (SSS)

Private keys are never stored in their entirety. Instead, they are split into 3 shares using Shamir's Secret Sharing with a 2-of-3 threshold:

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                    Private Key Split (3 shares)                  │
│                                                                 │
│   Private Key → Shamir Split → Share A + Share B + Share C      │
│                                                                 │
│   Reconstruction requires any 2 of 3 shares                     │
└─────────────────────────────────────────────────────────────────┘

Share Distribution:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Share A    │  │   Share B    │  │   Share C    │
│   Device     │  │   Server     │  │ (User Backup)│
│  (IndexedDB) │  │  (Supabase)  │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
\`\`\`

### Security Guarantees

| Attack Scenario | Protection |
|-----------------|------------|
| Database breach | Only Share B (encrypted) - cannot reconstruct |
| Device stolen | Only Share A - needs PIN to use |
| Server compromise | Cannot decrypt Share B (needs user PIN) |
| Man-in-the-middle | HTTPS + signature verification |
| Admin access | Admin cannot obtain 2 shares |

### Encryption

- **Algorithm**: AES-256-GCM
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **User Input**: 6-digit PIN
- **Shares**: Each encrypted with PIN-derived key before storage

## Authentication Flow

### Email Magic Link Login

\`\`\`
1. User enters email
2. Server generates secure token, stores hash
3. Email sent with magic link
4. User clicks link → token verified
5. Session created (30-day HTTP-only cookie)
6. First login → PIN setup → Wallet creation
\`\`\`

### Signing Flow

\`\`\`
1. User initiates transaction
2. Enter 6-digit PIN
3. Device share retrieved from IndexedDB
4. Server share retrieved from Supabase
5. Shares decrypted with PIN-derived key
6. Private key reconstructed
7. Transaction signed
8. Private key immediately destroyed
\`\`\`

### Recovery Flow

\`\`\`
1. User logs in on new device
2. Enter recovery phrase (Share C)
3. Server provides Share B
4. Private key reconstructed
5. New device share generated
6. Share A stored in new device
\`\`\`

## Database Schema

### Tables

- `auth_users` - User accounts (email, OAuth IDs)
- `magic_links` - Passwordless login tokens
- `embedded_wallets` - Encrypted wallet shares
- `auth_sessions` - Session management
- `device_shares` - Device-bound shares backup
- `wallet_recovery_requests` - Recovery tracking

### Row Level Security

All tables have RLS enabled. Users can only access their own data.

## API Endpoints

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/magic-link/send` | POST | Send magic link email |
| `/api/auth/magic-link/verify` | GET | Verify magic link token |
| `/api/auth/session` | GET | Get current session |
| `/api/auth/session` | DELETE | Logout |
| `/api/auth/oauth/google/callback` | GET | Handle Google OAuth callback |
| `/api/auth/oauth/apple/callback` | GET | Handle Apple OAuth callback |

### Wallet

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/wallet/create` | POST | Create embedded wallet |
| `/api/auth/wallet/get` | GET | Get wallet info |
| `/api/auth/wallet/sign` | POST | Sign transaction/message |

## Client Usage

### AuthProvider

\`\`\`tsx
import { AuthProvider, useAuth } from '@/contexts/auth-provider'

// Wrap your app
<AuthProvider>
  <App />
</AuthProvider>

// Use in components
function MyComponent() {
  const {
    user,
    isAuthenticated,
    hasWallet,
    sendMagicLink,
    createWallet,
    signMessage,
    signTransaction,
    logout,
    googleLogin,
    appleLogin
  } = useAuth()
  
  // ...
}
\`\`\`

### Sign a Message

\`\`\`tsx
const { signMessage } = useAuth()

const handleSign = async () => {
  const pin = await promptUserForPIN()
  const result = await signMessage("Hello World", pin)
  
  if (result.success) {
    console.log("Signature:", result.signature)
  } else {
    console.error("Error:", result.error)
  }
}
\`\`\`

### Sign a Transaction

\`\`\`tsx
const { signTransaction } = useAuth()

const handleSend = async () => {
  const tx = {
    to: "0x...",
    value: ethers.parseEther("0.1"),
    chainId: 1
  }
  
  const pin = await promptUserForPIN()
  const result = await signTransaction(tx, pin)
  
  if (result.success) {
    // Broadcast result.signedTx
  }
}
\`\`\`

## File Structure

\`\`\`
lib/auth/
├── config.ts              # Configuration constants
├── crypto.ts              # AES-256-GCM, PBKDF2, hashing
├── shamir.ts              # Shamir's Secret Sharing
├── embedded-wallet.ts     # Wallet creation, signing
├── session.ts             # Session management
├── device-storage.ts      # IndexedDB for device shares
├── oauth.ts               # OAuth handling

app/api/auth/
├── magic-link/
│   ├── send/route.ts      # Send magic link
│   └── verify/route.ts    # Verify magic link
├── wallet/
│   ├── create/route.ts    # Create wallet
│   ├── get/route.ts       # Get wallet info
│   └── sign/route.ts      # Sign transactions
├── session/route.ts       # Session management
├── oauth/
│   ├── google/
│   │   └── callback.ts    # Handle Google OAuth callback
│   └── apple/
│       └── callback.ts     # Handle Apple OAuth callback

components/auth/
├── auth-gateway.tsx       # Main auth modal
├── auth-modal.tsx         # Modal container
├── auth-mode-switcher.tsx # Personal/Business toggle
├── personal-login.tsx     # Personal login options
├── business-login.tsx     # Business login options
├── email-input.tsx        # Email input form
├── pin-setup.tsx          # PIN setup/entry
└── wallet-backup.tsx      # Backup phrase display

contexts/
└── auth-provider.tsx      # Auth context & hooks
\`\`\`

## Security Best Practices

1. **Never log or expose private keys**
2. **PIN is never sent to server** - only used client-side for decryption
3. **Sessions are HTTP-only cookies** - protected from XSS
4. **Rate limiting** on magic link requests
5. **Token hashing** - tokens stored as SHA-256 hashes
6. **Constant-time comparison** for token verification

## Future Enhancements

- [ ] WebAuthn/Passkey support
- [ ] Hardware key backup (YubiKey)
- [ ] Multi-device sync
- [ ] Social recovery (trusted contacts)

## OAuth Configuration

To enable Google and Apple OAuth, add the following environment variables:

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain.com/api/auth/oauth/google/callback`
4. Add environment variables in the **Vars** section of the in-chat sidebar:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### Apple OAuth

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a Services ID with Sign in with Apple enabled
3. Add redirect URL: `https://your-domain.com/api/auth/oauth/apple/callback`
4. Add environment variables:
   - `APPLE_CLIENT_ID` (Services ID)
   - `APPLE_TEAM_ID`
   - `APPLE_KEY_ID`
   - `APPLE_PRIVATE_KEY`
