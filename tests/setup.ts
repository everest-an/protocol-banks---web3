/**
 * Jest Test Setup
 * Configures mocks and global test utilities
 */

// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.CDP_API_KEY = 'test-cdp-api-key';
process.env.CDP_API_SECRET = 'test-cdp-api-secret';
process.env.CDP_NETWORK = 'base-sepolia';
process.env.RELAYER_URL = 'https://test-relayer.example.com';
process.env.RELAYER_API_KEY = 'test-relayer-key';

// Mock Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
    })),
  })),
}));

// Mock session
jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
  createSession: jest.fn(),
  destroySession: jest.fn(),
}));

// Global test utilities
global.mockSupabaseResponse = (data: any, error: any = null) => {
  return { data, error };
};

// Extend Jest matchers
expect.extend({
  toBeValidEthereumAddress(received: string) {
    const pass = /^0x[a-fA-F0-9]{40}$/.test(received);
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid Ethereum address`,
    };
  },
  toBeValidUUID(received: string) {
    const pass = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(received);
    return {
      pass,
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidEthereumAddress(): R;
      toBeValidUUID(): R;
    }
  }
  function mockSupabaseResponse(data: any, error?: any): { data: any; error: any };
}
