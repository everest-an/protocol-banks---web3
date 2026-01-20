/**
 * @protocolbanks/sdk - Payment Links Module Tests
 */

import { PaymentLinkModule } from '../src/modules/links';

describe('PaymentLinkModule', () => {
  const apiSecret = 'test-api-secret-key-32-bytes-ok!';
  let linksModule: PaymentLinkModule;

  beforeEach(() => {
    linksModule = new PaymentLinkModule({
      baseUrl: 'https://pay.protocolbanks.com',
      apiSecret,
    });
  });

  describe('generate()', () => {
    it('should generate a valid payment link', () => {
      const link = linksModule.generate({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
        amount: '100',
        token: 'USDC',
        chainId: 1,
      });

      expect(link.url).toContain('https://pay.protocolbanks.com');
      expect(link.id).toBeDefined();
      expect(link.signature).toBeDefined();
      expect(link.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should include optional parameters', () => {
      const link = linksModule.generate({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
        amount: '100',
        token: 'USDC',
        chainId: 1,
        reference: 'order-123',
        memo: 'Payment for services',
        expiresIn: 3600,
      });

      expect(link.url).toContain('ref=order-123');
      expect(link.url).toContain('memo=');
    });

    it('should throw for invalid address', () => {
      expect(() =>
        linksModule.generate({
          to: 'invalid-address',
          amount: '100',
          token: 'USDC',
          chainId: 1,
        })
      ).toThrow();
    });

    it('should throw for invalid amount', () => {
      expect(() =>
        linksModule.generate({
          to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
          amount: '-100',
          token: 'USDC',
          chainId: 1,
        })
      ).toThrow();
    });
  });

  describe('verify()', () => {
    it('should verify a valid link', () => {
      const link = linksModule.generate({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
        amount: '100',
        token: 'USDC',
        chainId: 1,
      });

      const result = linksModule.verify(link.url);
      expect(result.valid).toBe(true);
      expect(result.expired).toBe(false);
    });

    it('should detect tampered links', () => {
      const link = linksModule.generate({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
        amount: '100',
        token: 'USDC',
        chainId: 1,
      });

      // Tamper with the amount
      const tamperedUrl = link.url.replace('amount=100', 'amount=1000');
      const result = linksModule.verify(tamperedUrl);
      expect(result.valid).toBe(false);
    });

    it('should detect expired links', () => {
      const link = linksModule.generate({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
        amount: '100',
        token: 'USDC',
        chainId: 1,
        expiresIn: -1, // Already expired
      });

      const result = linksModule.verify(link.url);
      expect(result.expired).toBe(true);
    });
  });

  describe('parse()', () => {
    it('should parse link parameters', () => {
      const link = linksModule.generate({
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21',
        amount: '100',
        token: 'USDC',
        chainId: 1,
        reference: 'order-123',
      });

      const params = linksModule.parse(link.url);
      expect(params.to).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21');
      expect(params.amount).toBe('100');
      expect(params.token).toBe('USDC');
      expect(params.chainId).toBe(1);
      expect(params.reference).toBe('order-123');
    });
  });

  describe('getSupportedChains()', () => {
    it('should return supported chains', () => {
      const chains = linksModule.getSupportedChains();
      expect(chains).toContain(1); // Ethereum
      expect(chains).toContain(137); // Polygon
      expect(chains).toContain('solana');
      expect(chains).toContain('bitcoin');
    });
  });

  describe('getSupportedTokens()', () => {
    it('should return tokens for EVM chains', () => {
      const tokens = linksModule.getSupportedTokens(1);
      expect(tokens).toContain('USDC');
      expect(tokens).toContain('USDT');
      expect(tokens).toContain('ETH');
    });

    it('should return tokens for Solana', () => {
      const tokens = linksModule.getSupportedTokens('solana');
      expect(tokens).toContain('USDC');
      expect(tokens).toContain('SOL');
    });

    it('should return tokens for Bitcoin', () => {
      const tokens = linksModule.getSupportedTokens('bitcoin');
      expect(tokens).toContain('BTC');
    });
  });
});
