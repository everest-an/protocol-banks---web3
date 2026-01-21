/**
 * PaidServer Unit Tests
 */

import { PaidServer, createPaidServer } from '../src/server';
import type { MCPServerConfig } from '../src/types';

// ============================================================================
// Test Configuration
// ============================================================================

const testConfig: MCPServerConfig = {
  name: 'test-server',
  version: '1.0.0',
  recipient: {
    evm: {
      address: '0x1234567890123456789012345678901234567890',
      isTestnet: true,
    },
  },
  facilitator: {
    url: 'https://test-facilitator.example.com',
  },
};

// ============================================================================
// PaidServer Tests
// ============================================================================

describe('PaidServer', () => {
  let server: PaidServer;

  beforeEach(() => {
    server = new PaidServer(testConfig);
  });

  describe('constructor', () => {
    it('should create a server with the given config', () => {
      expect(server.getConfig()).toEqual(testConfig);
    });

    it('should initialize with empty tools map', () => {
      expect(server.getTools().size).toBe(0);
    });
  });

  describe('tool registration', () => {
    it('should register a free tool', () => {
      server.tool(
        'test_tool',
        'A test tool',
        { type: 'object', properties: {} },
        async () => ({ result: 'success' })
      );

      const tools = server.getTools();
      expect(tools.size).toBe(1);
      expect(tools.get('test_tool')).toBeDefined();
      expect(tools.get('test_tool')?.isPaid).toBe(false);
    });

    it('should register a paid tool', () => {
      server.paidTool(
        'paid_tool',
        'A paid tool',
        '$0.01',
        { type: 'object', properties: {} },
        async () => ({ result: 'success' })
      );

      const tools = server.getTools();
      expect(tools.size).toBe(1);
      expect(tools.get('paid_tool')).toBeDefined();
      expect(tools.get('paid_tool')?.isPaid).toBe(true);
      expect(tools.get('paid_tool')?.price).toBe('0.01');
    });

    it('should register multiple tools', () => {
      server.tool('free1', 'Free tool 1', {}, async () => ({}));
      server.tool('free2', 'Free tool 2', {}, async () => ({}));
      server.paidTool('paid1', 'Paid tool 1', '$1.00', {}, async () => ({}));

      expect(server.getTools().size).toBe(3);
    });
  });

  describe('parsePrice', () => {
    it('should parse dollar format: $0.001', () => {
      expect(server.parsePrice('$0.001')).toBe('0.001');
    });

    it('should parse dollar format: $10.00', () => {
      expect(server.parsePrice('$10.00')).toBe('10.00');
    });

    it('should parse USDC format: 0.001 USDC', () => {
      expect(server.parsePrice('0.001 USDC')).toBe('0.001');
    });

    it('should parse plain number: 0.001', () => {
      expect(server.parsePrice('0.001')).toBe('0.001');
    });

    it('should parse integer: 10', () => {
      expect(server.parsePrice('10')).toBe('10');
    });

    it('should handle whitespace: $ 0.001', () => {
      expect(server.parsePrice('$ 0.001')).toBe('0.001');
    });

    it('should return 0 for invalid format', () => {
      expect(server.parsePrice('invalid')).toBe('0');
    });

    it('should return 0 for empty string', () => {
      expect(server.parsePrice('')).toBe('0');
    });

    it('should handle large numbers', () => {
      expect(server.parsePrice('$1000000.00')).toBe('1000000.00');
    });

    it('should handle very small numbers', () => {
      expect(server.parsePrice('$0.000001')).toBe('0.000001');
    });
  });

  describe('generate402Response', () => {
    it('should generate valid 402 response', () => {
      server.paidTool('test', 'Test', '$1.00', {}, async () => ({}));
      const tool = server.getTools().get('test')!;
      
      const response = server.generate402Response(tool);
      
      expect(response.content).toHaveLength(1);
      expect(response.content[0].type).toBe('text');
      
      const parsed = JSON.parse(response.content[0].text!);
      expect(parsed.status).toBe(402);
      expect(parsed.error).toBe('Payment Required');
      expect(parsed.paymentRequired).toBeDefined();
      expect(parsed.paymentRequired.version).toBe('1.0');
      expect(parsed.paymentRequired.network).toBe('base-sepolia');
      expect(parsed.paymentRequired.paymentAddress).toBe(testConfig.recipient.evm.address);
      expect(parsed.paymentRequired.amount).toBe('1.00');
      expect(parsed.paymentRequired.token).toBe('USDC');
    });

    it('should include custom error message', () => {
      server.paidTool('test', 'Test', '$1.00', {}, async () => ({}));
      const tool = server.getTools().get('test')!;
      
      const response = server.generate402Response(tool, 'Custom error');
      const parsed = JSON.parse(response.content[0].text!);
      
      expect(parsed.error).toBe('Custom error');
    });

    it('should use mainnet network when not testnet', () => {
      const mainnetConfig: MCPServerConfig = {
        ...testConfig,
        recipient: {
          evm: {
            address: '0x1234567890123456789012345678901234567890',
            isTestnet: false,
          },
        },
      };
      
      const mainnetServer = new PaidServer(mainnetConfig);
      mainnetServer.paidTool('test', 'Test', '$1.00', {}, async () => ({}));
      const tool = mainnetServer.getTools().get('test')!;
      
      const response = mainnetServer.generate402Response(tool);
      const parsed = JSON.parse(response.content[0].text!);
      
      expect(parsed.paymentRequired.network).toBe('base');
    });
  });

  describe('getServer', () => {
    it('should return the underlying MCP Server', () => {
      const mcpServer = server.getServer();
      expect(mcpServer).toBeDefined();
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createPaidServer', () => {
  it('should create a PaidServer instance', () => {
    const server = createPaidServer(testConfig);
    expect(server).toBeInstanceOf(PaidServer);
  });
});
