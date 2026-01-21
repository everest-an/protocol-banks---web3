# Changelog

All notable changes to Protocol Banks are documented here.

## [1.2.0] - 2025-01-20

### Added
- **Reown AppKit Integration**
  - Email login (passwordless authentication)
  - Social logins (Google, Twitter, GitHub, Discord, Apple, Facebook)
  - Multi-wallet support (300+ wallets via WalletConnect)
  - Built-in fiat on-ramp (Coinbase Pay, MoonPay, Transak)
  - Mobile-first wallet creation

- **Environment Setup Guides**
  - `ENV_SETUP.md` - Complete environment variable configuration guide
  - `REOWN_SETUP.md` - Reown AppKit integration documentation
  - Domain verification instructions for Resend email

- **Enhanced Contact System**
  - Custom email domain support (`e.protocolbanks.com`)
  - reCAPTCHA v3 integration
  - Server-side key fetching for security

### Changed
- Updated authentication flow to support both Reown and custom auth
- Improved mobile responsiveness across all pages
- Enhanced security with server-side reCAPTCHA verification

### Fixed
- `btoa()` Unicode encoding errors in crypto modules
- Mobile layout overlapping issues in Network Graph
- PWA install prompt visibility on iOS Chrome

---

## [1.1.0] - 2025-01-15

### Added
- **Go Microservices Architecture**
  - Payout Engine (batch payment processing)
  - Event Indexer (multi-chain monitoring)
  - Webhook Handler (Rain/Transak integration)
  - gRPC communication layer
  - Kubernetes deployment configs

- **Custom Authentication System**
  - Shamir Secret Sharing (2-of-3 threshold)
  - Email Magic Link login
  - Google OAuth integration
  - Biometric verification (WebAuthn)
  - Embedded HD wallet generation

- **Mobile PWA Features**
  - Add to Home Screen prompts
  - Push notifications
  - Bottom navigation bar
  - Drawer panels for mobile

- **Sonic Branding**
  - Audio feedback system
  - Personal/Business mode sounds
  - Volume controls

### Changed
- Replaced Privy with custom authentication
- Migrated batch payment logic to Go
- Improved multi-sig mobile experience

---

## [1.0.0] - 2025-01-01

### Added
- Initial release
- Multi-chain payment support
- Batch payment processing
- Multi-signature wallets (Gnosis Safe)
- Cross-chain swap (Rango Exchange)
- ZetaChain integration
- Subscription management
- Security monitoring
- Admin dashboard
- Analytics page

---

## Links

- **Repository:** https://github.com/YOUR_ORG/protocol-banks
- **Documentation:** https://docs.protocolbanks.com
- **Website:** https://protocolbanks.com
