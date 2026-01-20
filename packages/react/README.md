# @protocolbanks/react

React components for ProtocolBanks cryptocurrency payment integration.

## Installation

```bash
npm install @protocolbanks/react @protocolbanks/sdk
# or
pnpm add @protocolbanks/react @protocolbanks/sdk
```

## Quick Start

```tsx
import { CheckoutProvider, PaymentButton, CheckoutModal } from '@protocolbanks/react';

function App() {
  return (
    <CheckoutProvider apiKey="pk_live_xxx">
      <PaymentButton
        amount="100"
        recipientAddress="0x1234..."
        token="USDC"
        onSuccess={(result) => console.log('Paid!', result)}
      />
      <CheckoutModal />
    </CheckoutProvider>
  );
}
```

## Components

### CheckoutProvider

Wrap your app with `CheckoutProvider` to enable payment functionality.

```tsx
<CheckoutProvider
  apiKey="pk_live_xxx"
  environment="production"
  theme={{ primaryColor: '#6366f1' }}
  locale="en"
>
  {children}
</CheckoutProvider>
```

### PaymentButton

A customizable button that opens the checkout modal.

```tsx
<PaymentButton
  amount="100"
  recipientAddress="0x1234..."
  token="USDC"
  variant="default" // 'default' | 'minimal' | 'branded' | 'outline'
  size="md"         // 'sm' | 'md' | 'lg'
  onSuccess={(result) => {}}
  onError={(error) => {}}
/>
```

### CheckoutWidget

Inline checkout widget for custom layouts.

```tsx
<CheckoutWidget
  amount="100"
  recipientAddress="0x1234..."
  allowedChains={[1, 137, 8453]}
  allowedTokens={['USDC', 'USDT']}
  onSuccess={(result) => {}}
  onClose={() => {}}
/>
```

## Hooks

### useCheckout

Programmatic control over checkout.

```tsx
const { openCheckout, closeCheckout, isOpen } = useCheckout();

openCheckout({
  amount: '100',
  recipientAddress: '0x1234...',
  token: 'USDC',
});
```

### useWallet

Wallet connection management.

```tsx
const { 
  address, 
  isConnected, 
  connect, 
  disconnect, 
  switchChain 
} = useWallet();

await connect('metamask'); // 'metamask' | 'walletconnect' | 'phantom'
```

## Theming

Customize the appearance with theme props:

```tsx
<CheckoutProvider
  apiKey="pk_live_xxx"
  theme={{
    primaryColor: '#6366f1',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    borderRadius: '12px',
    fontFamily: 'Inter, sans-serif',
    darkMode: false,
  }}
>
```

## Supported Chains

- Ethereum (1)
- Polygon (137)
- Base (8453)
- Arbitrum (42161)
- Optimism (10)
- BSC (56)
- Solana
- Bitcoin

## Supported Tokens

USDC, USDT, DAI, ETH, MATIC, BNB, SOL, BTC

## License

MIT
