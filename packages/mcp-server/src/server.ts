/**
 * ProtocolBanks MCP Server - PaidServer Implementation
 * 
 * Core MCP server with payment support for AI agents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import type {
  MCPServerConfig,
  ToolDefinition,
  ToolResponse,
  PaymentRequirement,
  PaymentRequiredResponse,
} from './types';
import { Logger } from './utils/logger';

// ============================================================================
// PaidServer Class
// ============================================================================

export class PaidServer {
  private server: Server;
  private config: MCPServerConfig;
  private tools: Map<string, ToolDefinition> = new Map();
  private logger: Logger;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.logger = new Logger({ level: 'info', prefix: 'MCP' });
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Define a paid tool that requires payment before execution
   */
  paidTool<T = unknown, R = unknown>(
    name: string,
    description: string,
    price: string,
    inputSchema: object,
    handler: (args: T) => Promise<R>
  ): void {
    const parsedPrice = this.parsePrice(price);
    
    this.tools.set(name, {
      name,
      description,
      price: parsedPrice,
      inputSchema,
      handler: handler as (args: unknown) => Promise<unknown>,
      isPaid: true,
    });
    
    this.logger.debug(`Registered paid tool: ${name} (${parsedPrice} USDC)`);
  }

  /**
   * Define a free tool
   */
  tool<T = unknown, R = unknown>(
    name: string,
    description: string,
    inputSchema: object,
    handler: (args: T) => Promise<R>
  ): void {
    this.tools.set(name, {
      name,
      description,
      inputSchema,
      handler: handler as (args: unknown) => Promise<unknown>,
      isPaid: false,
    });
    
    this.logger.debug(`Registered free tool: ${name}`);
  }

  /**
   * Get the underlying MCP Server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get server configuration
   */
  getConfig(): MCPServerConfig {
    return this.config;
  }

  /**
   * Get all registered tools
   */
  getTools(): Map<string, ToolDefinition> {
    return this.tools;
  }

  // ==========================================================================
  // Price Parsing
  // ==========================================================================

  /**
   * Parse human-readable price string to numeric amount
   * Supports formats: "$0.001", "0.001 USDC", "0.001"
   */
  parsePrice(price: string): string {
    // Remove currency symbols and whitespace
    const cleaned = price.replace(/[$\s]/g, '');
    
    // Extract numeric value
    const match = cleaned.match(/^([\d.]+)/);
    if (!match) {
      this.logger.warn(`Invalid price format: ${price}, defaulting to 0`);
      return '0';
    }
    
    const numericValue = match[1];
    
    // Validate it's a valid number
    const parsed = parseFloat(numericValue);
    if (isNaN(parsed) || parsed < 0) {
      this.logger.warn(`Invalid price value: ${numericValue}, defaulting to 0`);
      return '0';
    }
    
    return numericValue;
  }

  // ==========================================================================
  // Request Handlers
  // ==========================================================================

  private setupHandlers(): void {
    // ListTools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(t => ({
        name: t.name,
        description: t.isPaid 
          ? `${t.description} (Price: ${t.price} USDC)`
          : t.description,
        inputSchema: t.inputSchema,
      }));
      
      this.logger.debug(`Listed ${tools.length} tools`);
      return { tools };
    });

    // CallTool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      
      this.logger.info(`Tool call: ${name}`);
      
      const tool = this.tools.get(name);
      if (!tool) {
        return this.createErrorResponse('TOOL_NOT_FOUND', `Tool '${name}' not found`);
      }

      // Check payment for paid tools
      if (tool.isPaid) {
        const meta = request.params as { _meta?: { payment?: string } };
        const paymentHeader = meta._meta?.payment;
        
        if (!paymentHeader) {
          this.logger.info(`Payment required for tool: ${name}`);
          return this.generate402Response(tool);
        }

        // Verify payment
        const isValid = await this.verifyPayment(paymentHeader, tool.price!);
        if (!isValid) {
          this.logger.warn(`Payment verification failed for tool: ${name}`);
          return this.generate402Response(tool, 'Payment verification failed');
        }
        
        this.logger.info(`Payment verified for tool: ${name}`);
      }

      // Execute tool
      try {
        const result = await tool.handler(args);
        return this.createSuccessResponse(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Tool execution error: ${name} - ${message}`);
        return this.createErrorResponse('INTERNAL_ERROR', message);
      }
    });
  }

  // ==========================================================================
  // Response Generators
  // ==========================================================================

  /**
   * Generate 402 Payment Required response
   */
  generate402Response(tool: ToolDefinition, error?: string): ToolResponse {
    const paymentRequirement: PaymentRequirement = {
      version: '1.0',
      network: this.config.recipient.evm.isTestnet ? 'base-sepolia' : 'base',
      paymentAddress: this.config.recipient.evm.address,
      amount: tool.price || '0',
      token: 'USDC',
      memo: `Payment for ${tool.name}`,
      validUntil: Math.floor(Date.now() / 1000) + 3600, // 1 hour validity
    };

    const response: PaymentRequiredResponse = {
      status: 402,
      error: error || 'Payment Required',
      paymentRequired: paymentRequirement,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  }

  /**
   * Create success response
   */
  private createSuccessResponse(data: unknown): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(data, null, 2),
      }],
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(code: string, message: string): ToolResponse {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          code,
          message,
        }, null, 2),
      }],
      isError: true,
    };
  }

  // ==========================================================================
  // Payment Verification
  // ==========================================================================

  /**
   * Verify payment against expected amount
   */
  async verifyPayment(payment: string, expectedAmount: string): Promise<boolean> {
    if (!this.config.facilitator?.url) {
      this.logger.warn('No facilitator configured, skipping payment verification');
      return false;
    }

    try {
      const response = await fetch(`${this.config.facilitator.url}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment, expectedAmount }),
      });
      
      if (!response.ok) {
        this.logger.warn(`Facilitator verification failed: ${response.status}`);
        return false;
      }
      
      const result = await response.json() as { valid?: boolean };
      return result.valid === true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Payment verification error: ${message}`);
      return false;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new PaidServer instance
 */
export function createPaidServer(config: MCPServerConfig): PaidServer {
  return new PaidServer(config);
}
