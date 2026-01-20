/**
 * @protocolbanks/react - Type Definitions
 */

import type {
  ChainId,
  TokenSymbol,
  CheckoutTheme,
  CheckoutLocale,
  CheckoutResult,
  CheckoutConfig,
} from '@protocolbanks/sdk';

// ============================================================================
// Context Types
// ============================================================================

export interface CheckoutContextValue {
  /** SDK API Key */
  apiKey: string;
  /** Current environment */
  environment: 'production' | 'sandbox' | 'testnet';
  /** Default theme */
  theme: CheckoutTheme;
  /** Default locale */
  locale: CheckoutLocale;
  /** Whether checkout is currently open */
  isOpen: boolean;
  /** Current checkout config */
  currentConfig: CheckoutConfig | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Open checkout modal */
  openCheckout: (config: CheckoutConfig) => void;
  /** Close checkout modal */
  closeCheckout: () => void;
  /** Get supported chains */
  getSupportedChains: () => ChainId[];
  /** Get supported tokens for a chain */
  getSupportedTokens: (chain: ChainId) => TokenSymbol[];
}

// ============================================================================
// Provider Props
// ============================================================================

export interface CheckoutProviderProps {
  /** SDK API Key (required) */
  apiKey: string;
  /** API Secret for server-side operations */
  apiSecret?: string;
  /** Environment */
  environment?: 'production' | 'sandbox' | 'testnet';
  /** Default theme for all checkout components */
  theme?: CheckoutTheme;
  /** Default locale */
  locale?: CheckoutLocale;
  /** Children */
  children: React.ReactNode;
}

// ============================================================================
// Widget Props
// ============================================================================

export interface CheckoutWidgetProps {
  /** Payment amount (required) */
  amount: string;
  /** Recipient wallet address (required) */
  recipientAddress: string;
  /** Default token */
  token?: TokenSymbol;
  /** Default chain */
  chain?: ChainId;
  /** Allowed chains */
  allowedChains?: ChainId[];
  /** Allowed tokens */
  allowedTokens?: TokenSymbol[];
  /** Order ID for tracking */
  orderId?: string;
  /** Payment memo */
  memo?: string;
  /** Callback URL after payment */
  callbackUrl?: string;
  /** Webhook URL for notifications */
  webhookUrl?: string;
  /** Custom theme override */
  theme?: CheckoutTheme;
  /** Locale override */
  locale?: CheckoutLocale;
  /** Custom metadata */
  metadata?: Record<string, string>;
  /** Success callback */
  onSuccess?: (result: CheckoutResult) => void;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Close callback */
  onClose?: () => void;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

// ============================================================================
// Button Props
// ============================================================================

export type PaymentButtonVariant = 'default' | 'minimal' | 'branded' | 'outline';
export type PaymentButtonSize = 'sm' | 'md' | 'lg';

export interface PaymentButtonProps {
  /** Payment amount (required) */
  amount: string;
  /** Recipient wallet address (required) */
  recipientAddress: string;
  /** Default token */
  token?: TokenSymbol;
  /** Default chain */
  chain?: ChainId;
  /** Allowed chains */
  allowedChains?: ChainId[];
  /** Allowed tokens */
  allowedTokens?: TokenSymbol[];
  /** Order ID */
  orderId?: string;
  /** Payment memo */
  memo?: string;
  /** Button variant */
  variant?: PaymentButtonVariant;
  /** Button size */
  size?: PaymentButtonSize;
  /** Button text */
  children?: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Success callback */
  onSuccess?: (result: CheckoutResult) => void;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Custom class name */
  className?: string;
  /** Custom styles */
  style?: React.CSSProperties;
}

// ============================================================================
// Selector Props
// ============================================================================

export interface ChainSelectorProps {
  /** Selected chain */
  value?: ChainId;
  /** Allowed chains */
  allowedChains?: ChainId[];
  /** Change handler */
  onChange: (chain: ChainId) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

export interface TokenSelectorProps {
  /** Selected token */
  value?: TokenSymbol;
  /** Current chain */
  chain?: ChainId;
  /** Allowed tokens */
  allowedTokens?: TokenSymbol[];
  /** Change handler */
  onChange: (token: TokenSymbol) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseCheckoutReturn {
  /** Open checkout with config */
  openCheckout: (config: CheckoutConfig) => void;
  /** Close checkout */
  closeCheckout: () => void;
  /** Whether checkout is open */
  isOpen: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

export interface UseWalletReturn {
  /** Connected wallet address */
  address: string | null;
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether connecting */
  isConnecting: boolean;
  /** Current chain ID */
  chainId: ChainId | null;
  /** Connect wallet */
  connect: (walletType?: 'metamask' | 'walletconnect' | 'phantom') => Promise<void>;
  /** Disconnect wallet */
  disconnect: () => void;
  /** Switch chain */
  switchChain: (chainId: ChainId) => Promise<void>;
  /** Sign message */
  signMessage: (message: string) => Promise<string>;
  /** Error state */
  error: string | null;
}

// ============================================================================
// Internal Types
// ============================================================================

export interface PaymentState {
  step: 'select' | 'connect' | 'confirm' | 'processing' | 'success' | 'error';
  selectedChain: ChainId | null;
  selectedToken: TokenSymbol | null;
  walletAddress: string | null;
  transactionHash: string | null;
  error: string | null;
}

export type PaymentAction =
  | { type: 'SELECT_CHAIN'; chain: ChainId }
  | { type: 'SELECT_TOKEN'; token: TokenSymbol }
  | { type: 'CONNECT_WALLET'; address: string }
  | { type: 'START_PAYMENT' }
  | { type: 'PAYMENT_SUCCESS'; hash: string }
  | { type: 'PAYMENT_ERROR'; error: string }
  | { type: 'RESET' };
