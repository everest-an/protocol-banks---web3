/**
 * ProtocolBanks MCP Server - Dynamic Pricing Utilities
 * 
 * Support for dynamic pricing based on request parameters.
 */

// ============================================================================
// Types
// ============================================================================

export interface PricingRule {
  /** Base price in USDC */
  basePrice: string;
  /** Price per unit (e.g., per token, per request) */
  perUnitPrice?: string;
  /** Unit name for display */
  unitName?: string;
  /** Minimum price */
  minPrice?: string;
  /** Maximum price */
  maxPrice?: string;
}

export interface DynamicPriceParams {
  /** Number of units (e.g., token count, request count) */
  units?: number;
  /** Tier level (e.g., 'basic', 'pro', 'enterprise') */
  tier?: string;
  /** Custom multiplier */
  multiplier?: number;
}

export interface PriceCalculation {
  /** Final price in USDC */
  price: string;
  /** Breakdown of price components */
  breakdown: {
    basePrice: string;
    unitPrice?: string;
    units?: number;
    multiplier?: number;
  };
  /** Human-readable description */
  description: string;
}

// ============================================================================
// Pricing Calculator
// ============================================================================

export class PricingCalculator {
  private rules: Map<string, PricingRule> = new Map();

  /**
   * Register a pricing rule for a tool
   */
  registerRule(toolName: string, rule: PricingRule): void {
    this.rules.set(toolName, rule);
  }

  /**
   * Calculate price for a tool based on parameters
   */
  calculatePrice(toolName: string, params: DynamicPriceParams = {}): PriceCalculation {
    const rule = this.rules.get(toolName);
    
    if (!rule) {
      return {
        price: '0',
        breakdown: { basePrice: '0' },
        description: 'No pricing rule found',
      };
    }

    let price = parseFloat(rule.basePrice);
    const breakdown: PriceCalculation['breakdown'] = {
      basePrice: rule.basePrice,
    };

    // Add per-unit pricing
    if (rule.perUnitPrice && params.units && params.units > 0) {
      const unitPrice = parseFloat(rule.perUnitPrice) * params.units;
      price += unitPrice;
      breakdown.unitPrice = rule.perUnitPrice;
      breakdown.units = params.units;
    }

    // Apply multiplier
    if (params.multiplier && params.multiplier > 0) {
      price *= params.multiplier;
      breakdown.multiplier = params.multiplier;
    }

    // Apply tier multiplier
    if (params.tier) {
      const tierMultiplier = getTierMultiplier(params.tier);
      price *= tierMultiplier;
    }

    // Apply min/max bounds
    if (rule.minPrice) {
      price = Math.max(price, parseFloat(rule.minPrice));
    }
    if (rule.maxPrice) {
      price = Math.min(price, parseFloat(rule.maxPrice));
    }

    // Format price
    const formattedPrice = formatPrice(price);

    // Generate description
    const description = generatePriceDescription(rule, params, formattedPrice);

    return {
      price: formattedPrice,
      breakdown,
      description,
    };
  }

  /**
   * Get pricing rule for a tool
   */
  getRule(toolName: string): PricingRule | undefined {
    return this.rules.get(toolName);
  }

  /**
   * Check if a tool has dynamic pricing
   */
  hasDynamicPricing(toolName: string): boolean {
    const rule = this.rules.get(toolName);
    return rule !== undefined && (rule.perUnitPrice !== undefined || rule.minPrice !== undefined);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get multiplier for a tier
 */
function getTierMultiplier(tier: string): number {
  const multipliers: Record<string, number> = {
    basic: 1.0,
    standard: 1.0,
    pro: 0.9,      // 10% discount
    premium: 0.85, // 15% discount
    enterprise: 0.8, // 20% discount
  };
  return multipliers[tier.toLowerCase()] || 1.0;
}

/**
 * Format price to appropriate decimal places
 */
function formatPrice(price: number): string {
  if (price < 0.000001) {
    return '0';
  }
  if (price < 0.01) {
    return price.toFixed(6);
  }
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}

/**
 * Generate human-readable price description
 */
function generatePriceDescription(
  rule: PricingRule,
  params: DynamicPriceParams,
  finalPrice: string
): string {
  const parts: string[] = [];
  
  parts.push(`Base: ${rule.basePrice} USDC`);
  
  if (rule.perUnitPrice && params.units) {
    const unitName = rule.unitName || 'unit';
    parts.push(`+ ${params.units} ${unitName}s × ${rule.perUnitPrice} USDC`);
  }
  
  if (params.tier) {
    parts.push(`(${params.tier} tier)`);
  }
  
  parts.push(`= ${finalPrice} USDC`);
  
  return parts.join(' ');
}

// ============================================================================
// Pre-defined Pricing Rules
// ============================================================================

/**
 * Common pricing rules for AI-related tools
 */
export const AI_PRICING_RULES: Record<string, PricingRule> = {
  // Per-token pricing (like GPT)
  text_generation: {
    basePrice: '0',
    perUnitPrice: '0.00001', // $0.01 per 1000 tokens
    unitName: 'token',
    minPrice: '0.001',
    maxPrice: '1.00',
  },
  
  // Per-image pricing
  image_generation: {
    basePrice: '0.02',
    perUnitPrice: '0.02',
    unitName: 'image',
    minPrice: '0.02',
    maxPrice: '0.50',
  },
  
  // Per-minute pricing (audio/video)
  audio_transcription: {
    basePrice: '0',
    perUnitPrice: '0.006', // $0.006 per minute
    unitName: 'minute',
    minPrice: '0.01',
  },
  
  // Flat rate
  premium_analysis: {
    basePrice: '0.01',
    minPrice: '0.01',
    maxPrice: '0.10',
  },
};

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PricingCalculator with optional pre-defined rules
 */
export function createPricingCalculator(
  preloadRules: boolean = false
): PricingCalculator {
  const calculator = new PricingCalculator();
  
  if (preloadRules) {
    for (const [name, rule] of Object.entries(AI_PRICING_RULES)) {
      calculator.registerRule(name, rule);
    }
  }
  
  return calculator;
}

// ============================================================================
// Price Parsing Utilities
// ============================================================================

/**
 * Parse price string to numeric amount
 * Supports: "$0.001", "0.001 USDC", "0.001"
 */
export function parsePrice(price: string): string {
  const cleaned = price.replace(/[$\s]/g, '');
  const match = cleaned.match(/^([\d.]+)/);
  
  if (!match) {
    return '0';
  }
  
  const numericValue = match[1];
  const parsed = parseFloat(numericValue);
  
  if (isNaN(parsed) || parsed < 0) {
    return '0';
  }
  
  return numericValue;
}

/**
 * Format price for display
 */
export function formatPriceForDisplay(amount: string, token: string = 'USDC'): string {
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return `${amount} ${token}`;
  }
  
  if (num < 0.01) {
    return `${num.toFixed(6)} ${token}`;
  } else if (num < 1) {
    return `${num.toFixed(4)} ${token}`;
  } else {
    return `${num.toFixed(2)} ${token}`;
  }
}

/**
 * Compare two prices
 */
export function comparePrices(a: string, b: string): number {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  
  if (isNaN(numA) && isNaN(numB)) return 0;
  if (isNaN(numA)) return -1;
  if (isNaN(numB)) return 1;
  
  return numA - numB;
}
