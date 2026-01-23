// Jest setup file for Protocol Banks testing

// Mock environment variables for testing
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock crypto for Node.js environment
if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto as Crypto;
}

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
