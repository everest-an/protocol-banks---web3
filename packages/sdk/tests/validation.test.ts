/**
 * @protocolbanks/sdk - Address Validation Tests
 */

import {
  isValidEVMAddress,
  isValidSolanaAddress,
  isValidBitcoinAddress,
  isValidAddress,
  containsHomoglyphs,
  validateAmount,
} from '../src/utils/validation';

describe('Address Validation', () => {
  describe('EVM Address Validation', () => {
    it('should accept valid EVM addresses', () => {
      expect(isValidEVMAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21')).toBe(true);
      expect(isValidEVMAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('should reject invalid EVM addresses', () => {
      expect(isValidEVMAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE2')).toBe(false); // too short
      expect(isValidEVMAddress('742d35Cc6634C0532925a3b844Bc9e7595f5bE21')).toBe(false); // no 0x
      expect(isValidEVMAddress('0xGGGd35Cc6634C0532925a3b844Bc9e7595f5bE21')).toBe(false); // invalid hex
      expect(isValidEVMAddress('')).toBe(false);
    });
  });

  describe('Solana Address Validation', () => {
    it('should accept valid Solana addresses', () => {
      expect(isValidSolanaAddress('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy')).toBe(true);
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
    });

    it('should reject invalid Solana addresses', () => {
      expect(isValidSolanaAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21')).toBe(false);
      expect(isValidSolanaAddress('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21h')).toBe(false); // too short
      expect(isValidSolanaAddress('')).toBe(false);
    });
  });

  describe('Bitcoin Address Validation', () => {
    it('should accept valid Bitcoin addresses', () => {
      // Legacy P2PKH
      expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
      // P2SH
      expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')).toBe(true);
      // Bech32
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });

    it('should reject invalid Bitcoin addresses', () => {
      expect(isValidBitcoinAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21')).toBe(false);
      expect(isValidBitcoinAddress('')).toBe(false);
    });
  });

  describe('Universal Address Validation', () => {
    it('should validate addresses for correct chain', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21', 1)).toBe(true); // Ethereum
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21', 137)).toBe(true); // Polygon
      expect(isValidAddress('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', 'solana')).toBe(true);
      expect(isValidAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'bitcoin')).toBe(true);
    });

    it('should reject addresses for wrong chain', () => {
      expect(isValidAddress('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy', 1)).toBe(false);
      expect(isValidAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21', 'solana')).toBe(false);
    });
  });
});

describe('Homoglyph Detection', () => {
  it('should detect Cyrillic homoglyphs', () => {
    // 'а' is Cyrillic, looks like Latin 'a'
    expect(containsHomoglyphs('0x742d35Сc6634C0532925a3b844Bc9e7595f5bE21')).toBe(true);
  });

  it('should not flag clean addresses', () => {
    expect(containsHomoglyphs('0x742d35Cc6634C0532925a3b844Bc9e7595f5bE21')).toBe(false);
    expect(containsHomoglyphs('DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy')).toBe(false);
  });
});

describe('Amount Validation', () => {
  it('should accept valid amounts', () => {
    expect(validateAmount('100')).toBe(true);
    expect(validateAmount('0.001')).toBe(true);
    expect(validateAmount('999999999')).toBe(true);
  });

  it('should reject invalid amounts', () => {
    expect(validateAmount('0')).toBe(false);
    expect(validateAmount('-100')).toBe(false);
    expect(validateAmount('abc')).toBe(false);
    expect(validateAmount('')).toBe(false);
  });
});
