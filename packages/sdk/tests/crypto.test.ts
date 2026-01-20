/**
 * @protocolbanks/sdk - Crypto Utilities Tests
 */

import {
  generateHmacSignature,
  verifyHmacSignature,
  encryptData,
  decryptData,
  generateNonce,
  constantTimeCompare,
} from '../src/utils/crypto';

describe('HMAC Signature', () => {
  const secret = 'test-secret-key-12345';
  const payload = JSON.stringify({ amount: '100', token: 'USDC' });

  it('should generate consistent signatures', () => {
    const sig1 = generateHmacSignature(payload, secret);
    const sig2 = generateHmacSignature(payload, secret);
    expect(sig1).toBe(sig2);
  });

  it('should generate different signatures for different payloads', () => {
    const sig1 = generateHmacSignature(payload, secret);
    const sig2 = generateHmacSignature(payload + 'x', secret);
    expect(sig1).not.toBe(sig2);
  });

  it('should verify valid signatures', () => {
    const signature = generateHmacSignature(payload, secret);
    expect(verifyHmacSignature(payload, signature, secret)).toBe(true);
  });

  it('should reject invalid signatures', () => {
    const signature = generateHmacSignature(payload, secret);
    expect(verifyHmacSignature(payload, signature + 'x', secret)).toBe(false);
    expect(verifyHmacSignature(payload + 'x', signature, secret)).toBe(false);
  });
});

describe('AES Encryption', () => {
  const key = 'test-encryption-key-32-bytes-ok!';
  const plaintext = 'sensitive data to encrypt';

  it('should encrypt and decrypt data correctly', () => {
    const encrypted = encryptData(plaintext, key);
    const decrypted = decryptData(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext each time (random IV)', () => {
    const encrypted1 = encryptData(plaintext, key);
    const encrypted2 = encryptData(plaintext, key);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should fail decryption with wrong key', () => {
    const encrypted = encryptData(plaintext, key);
    expect(() => decryptData(encrypted, 'wrong-key-32-bytes-long-enough!')).toThrow();
  });
});

describe('Nonce Generation', () => {
  it('should generate unique nonces', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    expect(nonces.size).toBe(100);
  });

  it('should generate 32-byte hex nonces', () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe('Constant Time Compare', () => {
  it('should return true for equal strings', () => {
    expect(constantTimeCompare('abc123', 'abc123')).toBe(true);
  });

  it('should return false for different strings', () => {
    expect(constantTimeCompare('abc123', 'abc124')).toBe(false);
    expect(constantTimeCompare('abc123', 'abc12')).toBe(false);
  });
});
