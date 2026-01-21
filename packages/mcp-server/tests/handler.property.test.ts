/**
 * Property-Based Tests: 402 Response Structure
 * 
 * Property 1: 402 Response Structure
 * For any paid tool called without valid payment, the response SHALL contain
 * a valid PaymentRequirement object with all required fields (version, network,
 * paymentAddress, amount, token).
 * 
 * Validates: Requirements 3.1, 3.2
 */

import * as fc from 'fast-check';
import { PaymentHandler, is402Response, extractPaymentRequirement } from '../src/handler';
import { PaidServer } from '../src/server';
import type { MCPServerConfig, PaymentRequirement } from '../src/types';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/** Generate valid Ethereum addresses */
const ethereumAddressArb = fc.hexaString({ minLength: 40, maxLength: 40 })
  .map(hex => `0x${hex}`);

/** Generate valid price strings */
const priceArb = fc.oneof(
  fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => `$${n.toFixed(6)}`),
  fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => `${n.toFixed(6)} USDC`),
  fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6))
);

/** Generate valid tool names */
const toolNameArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz_'.split('')),
  { minLength: 1, maxLength: 50 }
);

/** Generate valid memo strings */
const memoArb = fc.option(
  fc.string({ minLength: 1, maxLength: 200 }),
  { nil: undefined }
);

/** Generate MCP Server config */
const configArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  version: fc.constantFrom('1.0.0', '1.0.1', '2.0.0'),
  recipient: fc.record({
    evm: fc.record({
      address: ethereumAddressArb,
      isTestnet: fc.boolean(),
    }),
  }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 1: 402 Response Structure', () => {
  /**
   * Property: For any valid configuration and amount, generate402 produces
   * a response with all required PaymentRequirement fields.
   */
  it('should always include all required fields in PaymentRequirement', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        memoArb,
        (config, amount, memo) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount, memo);
          
          // Parse the response
          const content = response.content[0];
          expect(content.type).toBe('text');
          
          const parsed = JSON.parse(content.text!);
          
          // Verify 402 status
          expect(parsed.status).toBe(402);
          
          // Verify all required fields exist
          const requirement = parsed.paymentRequired as PaymentRequirement;
          expect(requirement.version).toBeDefined();
          expect(requirement.network).toBeDefined();
          expect(requirement.paymentAddress).toBeDefined();
          expect(requirement.amount).toBeDefined();
          expect(requirement.token).toBeDefined();
          
          // Verify field types
          expect(typeof requirement.version).toBe('string');
          expect(typeof requirement.network).toBe('string');
          expect(typeof requirement.paymentAddress).toBe('string');
          expect(typeof requirement.amount).toBe('string');
          expect(typeof requirement.token).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The payment address in the response matches the configured address.
   */
  it('should use the configured payment address', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          expect(parsed.paymentRequired.paymentAddress).toBe(config.recipient.evm.address);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The network is correctly set based on isTestnet flag.
   */
  it('should set network based on testnet configuration', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          const expectedNetwork = config.recipient.evm.isTestnet ? 'base-sepolia' : 'base';
          expect(parsed.paymentRequired.network).toBe(expectedNetwork);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: The amount in the response matches the requested amount.
   */
  it('should preserve the requested amount', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          expect(parsed.paymentRequired.amount).toBe(amount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Token is always USDC.
   */
  it('should always use USDC as token', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          expect(parsed.paymentRequired.token).toBe('USDC');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Version is always "1.0".
   */
  it('should always use version 1.0', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          expect(parsed.paymentRequired.version).toBe('1.0');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: validUntil is always in the future.
   */
  it('should set validUntil in the future', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const now = Math.floor(Date.now() / 1000);
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          expect(parsed.paymentRequired.validUntil).toBeGreaterThan(now);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: is402Response correctly identifies 402 responses.
   */
  it('should correctly identify 402 responses', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const parsed = JSON.parse(response.content[0].text!);
          expect(is402Response(parsed)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: extractPaymentRequirement extracts valid requirements.
   */
  it('should extract payment requirement from response', () => {
    fc.assert(
      fc.property(
        configArb,
        fc.float({ min: 0.000001, max: 1000000, noNaN: true }).map(n => n.toFixed(6)),
        (config, amount) => {
          const handler = new PaymentHandler(config as MCPServerConfig);
          const response = handler.generate402(amount);
          
          const requirement = extractPaymentRequirement(response);
          expect(requirement).not.toBeNull();
          expect(requirement?.amount).toBe(amount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('PaymentHandler.validatePaymentRequirement', () => {
  const config: MCPServerConfig = {
    name: 'test',
    version: '1.0.0',
    recipient: {
      evm: {
        address: '0x1234567890123456789012345678901234567890',
        isTestnet: true,
      },
    },
  };

  it('should validate complete requirements', () => {
    const handler = new PaymentHandler(config);
    const requirement: PaymentRequirement = {
      version: '1.0',
      network: 'base',
      paymentAddress: '0x1234',
      amount: '1.00',
      token: 'USDC',
    };
    
    expect(handler.validatePaymentRequirement(requirement)).toBe(true);
  });

  it('should reject incomplete requirements', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('version', 'network', 'paymentAddress', 'amount', 'token'),
        (missingField) => {
          const handler = new PaymentHandler(config);
          const requirement: Partial<PaymentRequirement> = {
            version: '1.0',
            network: 'base',
            paymentAddress: '0x1234',
            amount: '1.00',
            token: 'USDC',
          };
          
          delete requirement[missingField as keyof PaymentRequirement];
          
          expect(handler.validatePaymentRequirement(requirement)).toBe(false);
        }
      ),
      { numRuns: 5 }
    );
  });
});
