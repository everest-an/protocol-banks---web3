/**
 * Jest Test Setup
 */

// Extend Jest matchers
expect.extend({
  toBeValidErrorCode(received: string) {
    const pass = /^PB_[A-Z]+_[0-9]{3}$/.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid error code`
          : `expected ${received} to match pattern PB_XXX_NNN`,
    };
  },
  
  toBeValidAddress(received: string) {
    const evmPattern = /^0x[a-fA-F0-9]{40}$/;
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const pass = evmPattern.test(received) || solanaPattern.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid address`
          : `expected ${received} to be a valid EVM or Solana address`,
    };
  },
});

// Global test timeout
jest.setTimeout(30000);

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto;
}

// Mock fetch if not available
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = jest.fn();
}

// Declare custom matchers
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeValidErrorCode(): R;
      toBeValidAddress(): R;
    }
  }
}

export {};
