/**
 * @protocolbanks/sdk - Webhook Module Tests
 */

import { WebhookModule } from '../src/modules/webhooks';

describe('WebhookModule', () => {
  const webhookSecret = 'whsec_test_secret_key_32_bytes!';
  let webhookModule: WebhookModule;

  beforeEach(() => {
    webhookModule = new WebhookModule({ webhookSecret });
  });

  describe('sign()', () => {
    it('should generate a signature for payload', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'pay_123', amount: '100' },
      });

      const signature = webhookModule.sign(payload);
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should generate consistent signatures', () => {
      const payload = JSON.stringify({ event: 'payment.completed' });
      const sig1 = webhookModule.sign(payload);
      const sig2 = webhookModule.sign(payload);
      expect(sig1).toBe(sig2);
    });
  });

  describe('verify()', () => {
    it('should verify valid signatures', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'pay_123' },
      });
      const signature = webhookModule.sign(payload);

      const result = webhookModule.verify(payload, signature);
      expect(result).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const payload = JSON.stringify({ event: 'payment.completed' });
      const result = webhookModule.verify(payload, 'invalid_signature');
      expect(result).toBe(false);
    });

    it('should reject tampered payloads', () => {
      const payload = JSON.stringify({ event: 'payment.completed', amount: '100' });
      const signature = webhookModule.sign(payload);

      const tamperedPayload = JSON.stringify({ event: 'payment.completed', amount: '1000' });
      const result = webhookModule.verify(tamperedPayload, signature);
      expect(result).toBe(false);
    });
  });

  describe('parse()', () => {
    it('should parse payment.completed event', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        data: {
          id: 'pay_123',
          amount: '100',
          token: 'USDC',
          chainId: 1,
          txHash: '0xabc123',
        },
        timestamp: Date.now(),
      });

      const event = webhookModule.parse(payload);
      expect(event.type).toBe('payment.completed');
      expect(event.data.id).toBe('pay_123');
      expect(event.data.amount).toBe('100');
    });

    it('should parse payment.failed event', () => {
      const payload = JSON.stringify({
        event: 'payment.failed',
        data: {
          id: 'pay_456',
          error: 'Insufficient funds',
        },
        timestamp: Date.now(),
      });

      const event = webhookModule.parse(payload);
      expect(event.type).toBe('payment.failed');
      expect(event.data.error).toBe('Insufficient funds');
    });

    it('should parse batch.completed event', () => {
      const payload = JSON.stringify({
        event: 'batch.completed',
        data: {
          batchId: 'batch_789',
          totalRecipients: 10,
          successCount: 10,
          failedCount: 0,
        },
        timestamp: Date.now(),
      });

      const event = webhookModule.parse(payload);
      expect(event.type).toBe('batch.completed');
      expect(event.data.batchId).toBe('batch_789');
    });

    it('should parse x402.executed event', () => {
      const payload = JSON.stringify({
        event: 'x402.executed',
        data: {
          authorizationId: 'auth_abc',
          txHash: '0xdef456',
        },
        timestamp: Date.now(),
      });

      const event = webhookModule.parse(payload);
      expect(event.type).toBe('x402.executed');
      expect(event.data.authorizationId).toBe('auth_abc');
    });

    it('should throw for invalid JSON', () => {
      expect(() => webhookModule.parse('invalid json')).toThrow();
    });
  });

  describe('verifyAndParse()', () => {
    it('should verify and parse in one call', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'pay_123' },
        timestamp: Date.now(),
      });
      const signature = webhookModule.sign(payload);

      const event = webhookModule.verifyAndParse(payload, signature);
      expect(event.type).toBe('payment.completed');
    });

    it('should throw for invalid signature', () => {
      const payload = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'pay_123' },
      });

      expect(() => webhookModule.verifyAndParse(payload, 'invalid')).toThrow();
    });
  });
});
