/**
 * @protocolbanks/react
 * 
 * React components for ProtocolBanks cryptocurrency payment integration
 * 
 * @example
 * ```tsx
 * import { CheckoutProvider, PaymentButton } from '@protocolbanks/react';
 * 
 * function App() {
 *   return (
 *     <CheckoutProvider apiKey="pk_live_xxx">
 *       <PaymentButton
 *         amount="100"
 *         recipientAddress="0x1234..."
 *         token="USDC"
 *         onSuccess={(result) => console.log('Paid!', result)}
 *       />
 *     </CheckoutProvider>
 *   );
 * }
 * ```
 */

// Context
export { CheckoutProvider, useCheckoutContext } from './context/CheckoutContext';

// Components
export { CheckoutWidget } from './components/CheckoutWidget';
export { CheckoutModal } from './components/CheckoutModal';
export { PaymentButton } from './components/PaymentButton';
export { ChainSelector } from './components/ChainSelector';
export { TokenSelector } from './components/TokenSelector';

// Hooks
export { useCheckout } from './hooks/useCheckout';
export { useWallet } from './hooks/useWallet';

// Theme
export { defaultTheme, darkTheme, mergeTheme, getCSSVariables } from './theme';

// Types
export type {
  CheckoutContextValue,
  CheckoutProviderProps,
  CheckoutWidgetProps,
  PaymentButtonProps,
  PaymentButtonVariant,
  PaymentButtonSize,
  ChainSelectorProps,
  TokenSelectorProps,
  UseCheckoutReturn,
  UseWalletReturn,
} from './types';

// Re-export SDK types for convenience
export type {
  ChainId,
  TokenSymbol,
  CheckoutTheme,
  CheckoutLocale,
  CheckoutConfig,
  CheckoutResult,
} from '@protocolbanks/sdk';
