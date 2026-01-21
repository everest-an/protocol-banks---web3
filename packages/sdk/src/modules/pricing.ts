/**
 * ProtocolBanks SDK - Pricing Strategies Module
 * 
 * Supports multiple pricing models for API monetization:
 * - Per-request: Fixed price per API call
 * - Per-token: AI API pricing (input/output tokens)
 * - Dynamic: Custom pricing function
 * - Tiered: Volume-based pricing
 */

// ============================================================================
// Types
// ============================================================================

/** Pricing model types */
export type PricingModel = 'perRequest' | 'perToken' | 'dynamic' | 'tiered';

/** Pricing tier for volume discounts */
export interface PricingTier {
  upTo: number;      // Request count threshold
  price: string;     // Price in USD (e.g., "0.01")
}

/** Token usage for AI APIs */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Pricing configuration */
export interface PricingConfig {
  model: PricingModel;
  
  /** Per-request pricing (USD) */
  perRequest?: string;
  
  /** Per-token pricing for AI APIs (USD) */
  perInputToken?: string;
  perOutputToken?: string;
  
  /** Dynamic pricing function */
  dynamic?: (request: Request, context?: PricingContext) => Promise<string>;
  
  /** Tiered pricing */
  tiers?: PricingTier[];
  
  /** Minimum price (USD) */
  minPrice?: string;
  
  /** Maximum price (USD) */
  maxPrice?: string;
}

/** Context for pricing calculations */
export interface PricingContext {
  walletAddress?: string;
  requestCount?: number;
  endpoint?: string;
  method?: string;
  contentLength?: number;
  tokenUsage?: TokenUsage;
}

/** Price calculation result */
export interface PriceResult {
  price: string;           // Final price in USD
  breakdown?: PriceBreakdown;
  model: PricingModel;
}

/** Price breakdown for transparency */
export interface PriceBreakdown {
  basePrice: string;
  inputTokenCost?: string;
  outputTokenCost?: string;
  tierDiscount?: string;
  finalPrice: string;
}

// ============================================================================
// Pricing Strategy Interface
// ============================================================================

export interface IPricingStrategy {
  calculatePrice(request: Request, context?: PricingContext): Promise<PriceResult>;
  estimatePrice(context: PricingContext): string;
}

// ============================================================================
// Per-Request Pricing Strategy
// ============================================================================

export class PerRequestPricing implements IPricingStrategy {
  private price: string;
  private minPrice: string;
  private maxPrice: string;
  
  constructor(config: { price: string; minPrice?: string; maxPrice?: string }) {
    this.price = config.price;
    this.minPrice = config.minPrice ?? '0';
    this.maxPrice = config.maxPrice ?? '1000';
  }
  
  async calculatePrice(_request: Request, _context?: PricingContext): Promise<PriceResult> {
    const price = this.clampPrice(this.price);
    return {
      price,
      model: 'perRequest',
      breakdown: {
        basePrice: this.price,
        finalPrice: price,
      },
    };
  }
  
  estimatePrice(_context: PricingContext): string {
    return this.price;
  }
  
  private clampPrice(price: string): string {
    const p = parseFloat(price);
    const min = parseFloat(this.minPrice);
    const max = parseFloat(this.maxPrice);
    return Math.max(min, Math.min(max, p)).toFixed(6);
  }
}

// ============================================================================
// Per-Token Pricing Strategy (AI APIs)
// ============================================================================

export class PerTokenPricing implements IPricingStrategy {
  private perInputToken: string;
  private perOutputToken: string;
  private minPrice: string;
  private maxPrice: string;
  
  constructor(config: {
    perInputToken: string;
    perOutputToken: string;
    minPrice?: string;
    maxPrice?: string;
  }) {
    this.perInputToken = config.perInputToken;
    this.perOutputToken = config.perOutputToken;
    this.minPrice = config.minPrice ?? '0';
    this.maxPrice = config.maxPrice ?? '100';
  }
  
  async calculatePrice(request: Request, context?: PricingContext): Promise<PriceResult> {
    // Get token usage from context or estimate from request
    const tokenUsage = context?.tokenUsage ?? await this.estimateTokensFromRequest(request);
    
    const inputCost = tokenUsage.inputTokens * parseFloat(this.perInputToken);
    const outputCost = tokenUsage.outputTokens * parseFloat(this.perOutputToken);
    const totalCost = inputCost + outputCost;
    
    const price = this.clampPrice(totalCost.toFixed(6));
    
    return {
      price,
      model: 'perToken',
      breakdown: {
        basePrice: '0',
        inputTokenCost: inputCost.toFixed(6),
        outputTokenCost: outputCost.toFixed(6),
        finalPrice: price,
      },
    };
  }
  
  estimatePrice(context: PricingContext): string {
    const tokens = context.tokenUsage ?? { inputTokens: 1000, outputTokens: 500 };
    const inputCost = tokens.inputTokens * parseFloat(this.perInputToken);
    const outputCost = tokens.outputTokens * parseFloat(this.perOutputToken);
    return (inputCost + outputCost).toFixed(6);
  }
  
  private async estimateTokensFromRequest(request: Request): Promise<TokenUsage> {
    try {
      const body = await request.clone().text();
      // Rough estimate: 4 characters per token
      const inputTokens = Math.ceil(body.length / 4);
      // Estimate output as 50% of input for pre-payment
      const outputTokens = Math.ceil(inputTokens * 0.5);
      return { inputTokens, outputTokens };
    } catch {
      // Default estimate
      return { inputTokens: 1000, outputTokens: 500 };
    }
  }
  
  private clampPrice(price: string): string {
    const p = parseFloat(price);
    const min = parseFloat(this.minPrice);
    const max = parseFloat(this.maxPrice);
    return Math.max(min, Math.min(max, p)).toFixed(6);
  }
  
  /**
   * Update price after response (for accurate billing)
   */
  calculateActualPrice(tokenUsage: TokenUsage): string {
    const inputCost = tokenUsage.inputTokens * parseFloat(this.perInputToken);
    const outputCost = tokenUsage.outputTokens * parseFloat(this.perOutputToken);
    return (inputCost + outputCost).toFixed(6);
  }
}

// ============================================================================
// Dynamic Pricing Strategy
// ============================================================================

export class DynamicPricing implements IPricingStrategy {
  private pricingFn: (request: Request, context?: PricingContext) => Promise<string>;
  private minPrice: string;
  private maxPrice: string;
  
  constructor(config: {
    pricingFn: (request: Request, context?: PricingContext) => Promise<string>;
    minPrice?: string;
    maxPrice?: string;
  }) {
    this.pricingFn = config.pricingFn;
    this.minPrice = config.minPrice ?? '0';
    this.maxPrice = config.maxPrice ?? '1000';
  }
  
  async calculatePrice(request: Request, context?: PricingContext): Promise<PriceResult> {
    const calculatedPrice = await this.pricingFn(request, context);
    const price = this.clampPrice(calculatedPrice);
    
    return {
      price,
      model: 'dynamic',
      breakdown: {
        basePrice: calculatedPrice,
        finalPrice: price,
      },
    };
  }
  
  estimatePrice(_context: PricingContext): string {
    // Dynamic pricing can't be estimated without request
    return this.minPrice;
  }
  
  private clampPrice(price: string): string {
    const p = parseFloat(price);
    const min = parseFloat(this.minPrice);
    const max = parseFloat(this.maxPrice);
    return Math.max(min, Math.min(max, p)).toFixed(6);
  }
}

// ============================================================================
// Tiered Pricing Strategy
// ============================================================================

export class TieredPricing implements IPricingStrategy {
  private tiers: PricingTier[];
  private defaultPrice: string;
  
  constructor(config: { tiers: PricingTier[]; defaultPrice?: string }) {
    // Sort tiers by threshold ascending
    this.tiers = [...config.tiers].sort((a, b) => a.upTo - b.upTo);
    this.defaultPrice = config.defaultPrice ?? this.tiers[0]?.price ?? '0.01';
  }
  
  async calculatePrice(_request: Request, context?: PricingContext): Promise<PriceResult> {
    const requestCount = context?.requestCount ?? 0;
    const tier = this.getTierForCount(requestCount);
    const price = tier?.price ?? this.defaultPrice;
    
    return {
      price,
      model: 'tiered',
      breakdown: {
        basePrice: this.defaultPrice,
        tierDiscount: tier ? `Tier ${this.tiers.indexOf(tier) + 1}` : undefined,
        finalPrice: price,
      },
    };
  }
  
  estimatePrice(context: PricingContext): string {
    const requestCount = context.requestCount ?? 0;
    const tier = this.getTierForCount(requestCount);
    return tier?.price ?? this.defaultPrice;
  }
  
  private getTierForCount(count: number): PricingTier | undefined {
    // Find the tier where count is below the threshold
    for (const tier of this.tiers) {
      if (count < tier.upTo) {
        return tier;
      }
    }
    // Return last tier if count exceeds all thresholds
    return this.tiers[this.tiers.length - 1];
  }
  
  getTiers(): PricingTier[] {
    return [...this.tiers];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a pricing strategy from configuration
 */
export function createPricingStrategy(config: PricingConfig): IPricingStrategy {
  switch (config.model) {
    case 'perRequest':
      if (!config.perRequest) {
        throw new Error('perRequest price is required for perRequest pricing model');
      }
      return new PerRequestPricing({
        price: config.perRequest,
        minPrice: config.minPrice,
        maxPrice: config.maxPrice,
      });
      
    case 'perToken':
      if (!config.perInputToken || !config.perOutputToken) {
        throw new Error('perInputToken and perOutputToken are required for perToken pricing model');
      }
      return new PerTokenPricing({
        perInputToken: config.perInputToken,
        perOutputToken: config.perOutputToken,
        minPrice: config.minPrice,
        maxPrice: config.maxPrice,
      });
      
    case 'dynamic':
      if (!config.dynamic) {
        throw new Error('dynamic function is required for dynamic pricing model');
      }
      return new DynamicPricing({
        pricingFn: config.dynamic,
        minPrice: config.minPrice,
        maxPrice: config.maxPrice,
      });
      
    case 'tiered':
      if (!config.tiers || config.tiers.length === 0) {
        throw new Error('tiers are required for tiered pricing model');
      }
      return new TieredPricing({
        tiers: config.tiers,
        defaultPrice: config.perRequest,
      });
      
    default:
      throw new Error(`Unknown pricing model: ${config.model}`);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse price string to number
 */
export function parsePrice(price: string): number {
  const parsed = parseFloat(price);
  if (isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid price: ${price}`);
  }
  return parsed;
}

/**
 * Format price for display
 */
export function formatPrice(price: string | number, decimals = 6): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (num < 0.01) {
    return `$${num.toFixed(decimals)}`;
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Convert USD to USDC units (6 decimals)
 */
export function usdToUSDC(usd: string | number): string {
  const num = typeof usd === 'string' ? parseFloat(usd) : usd;
  return Math.floor(num * 1_000_000).toString();
}

/**
 * Convert USDC units to USD
 */
export function usdcToUSD(usdc: string | number): string {
  const num = typeof usdc === 'string' ? parseInt(usdc, 10) : usdc;
  return (num / 1_000_000).toFixed(6);
}

/**
 * Common AI model pricing presets
 */
export const AI_PRICING_PRESETS = {
  // GPT-4 Turbo pricing (approximate)
  'gpt-4-turbo': {
    perInputToken: '0.00001',    // $0.01 per 1K tokens
    perOutputToken: '0.00003',   // $0.03 per 1K tokens
  },
  // GPT-3.5 Turbo pricing
  'gpt-3.5-turbo': {
    perInputToken: '0.0000005',  // $0.0005 per 1K tokens
    perOutputToken: '0.0000015', // $0.0015 per 1K tokens
  },
  // Claude 3 Opus pricing
  'claude-3-opus': {
    perInputToken: '0.000015',   // $0.015 per 1K tokens
    perOutputToken: '0.000075',  // $0.075 per 1K tokens
  },
  // Claude 3 Sonnet pricing
  'claude-3-sonnet': {
    perInputToken: '0.000003',   // $0.003 per 1K tokens
    perOutputToken: '0.000015',  // $0.015 per 1K tokens
  },
} as const;

export type AIModelPreset = keyof typeof AI_PRICING_PRESETS;
