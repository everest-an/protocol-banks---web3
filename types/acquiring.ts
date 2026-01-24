/**
 * Acquiring Module Type Definitions
 */

export interface Merchant {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string;
  wallet_address: string;
  callback_url?: string;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface MerchantApiKey {
  id: string;
  merchant_id: string;
  key_id: string;
  key_secret_hash: string;
  name?: string;
  last_used_at?: string;
  created_at: string;
}

export interface AcquiringOrder {
  id: string;
  order_no: string;
  merchant_id: string;
  amount: number;
  currency: string;
  token: string;
  chain_id: number;
  payment_method?: "crypto_transfer" | "binance_pay" | "kucoin_pay";
  status: "pending" | "paid" | "expired" | "cancelled";
  payer_address?: string;
  tx_hash?: string;
  notify_url?: string;
  return_url?: string;
  expires_at: string;
  paid_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MerchantBalance {
  id: string;
  merchant_id: string;
  token: string;
  balance: number;
  updated_at: string;
}

export interface CreateOrderRequest {
  merchant_id: string;
  amount: number;
  currency?: string;
  token?: string;
  order_no?: string;
  notify_url?: string;
  return_url?: string;
  expire_minutes?: number;
  metadata?: Record<string, any>;
}

export interface CreateOrderResponse {
  success: boolean;
  order?: AcquiringOrder;
  checkout_url?: string;
  error?: string;
}

export interface PaymentMethod {
  id: "crypto_transfer" | "binance_pay" | "kucoin_pay";
  name: string;
  icon: string;
  badge?: "Instant" | "2-10 mins";
  description: string;
  fees_included: boolean;
  supported_tokens?: string[];
}
