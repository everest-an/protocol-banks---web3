#!/usr/bin/env node
/**
 * ProtocolBanks MCP Server - CLI Entry Point
 * 
 * Starts the MCP server with stdio transport for Claude Desktop integration.
 */

import { createPaidServer } from './server';
import { SubscriptionService } from './services/subscription.service';
import { registerSubscriptionTools } from './tools/subscriptions';
import { Logger } from './utils/logger';
import type { MCPServerConfig } from './types';

// ============================================================================
// Environment Configuration
// ============================================================================

function getEnvConfig(): MCPServerConfig {
  const env = process.env;
  const merchantAddress = env.MERCHANT_ADDRESS;
  
  if (!merchantAddress) {
    console.error('Error: MERCHANT_ADDRESS environment variable is required');
    process.exit(1);
  }

  const isTestnet = env.NETWORK === 'testnet' || 
                    env.NETWORK === 'base-sepolia';

  return {
    name: env.MCP_SERVER_NAME || 'protocolbanks-mcp',
    version: env.MCP_SERVER_VERSION || '1.0.0',
    recipient: {
      evm: {
        address: merchantAddress,
        isTestnet,
      },
    },
    facilitator: env.CDP_FACILITATOR_URL ? {
      url: env.CDP_FACILITATOR_URL,
    } : undefined,
    supabaseUrl: env.SUPABASE_URL,
    supabaseKey: env.SUPABASE_ANON_KEY,
  };
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const logger = new Logger({ level: 'info', prefix: 'CLI' });
  
  try {
    logger.info('Starting ProtocolBanks MCP Server...');
    
    // Get configuration from environment
    const config = getEnvConfig();
    logger.info(`Server: ${config.name} v${config.version}`);
    logger.info(`Network: ${config.recipient.evm.isTestnet ? 'testnet' : 'mainnet'}`);
    logger.info(`Recipient: ${config.recipient.evm.address}`);
    
    // Create the paid server
    const server = createPaidServer(config);
    
    // Initialize subscription service
    const subscriptionService = new SubscriptionService(
      config.supabaseUrl && config.supabaseKey ? {
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
      } : undefined
    );
    
    // Initialize if database is configured
    if (config.supabaseUrl && config.supabaseKey) {
      try {
        await subscriptionService.initialize();
        logger.info('Subscription service initialized with database');
      } catch (err) {
        logger.warn('Failed to initialize database, running in mock mode');
      }
    } else {
      logger.warn('Running in mock mode (no database configured)');
    }
    
    // Register subscription tools
    registerSubscriptionTools(server, subscriptionService);
    logger.info('Subscription tools registered');
    
    // Dynamic import for stdio transport
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    
    // Create stdio transport
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await server.getServer().connect(transport);
    logger.info('MCP Server connected via stdio transport');
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await server.getServer().close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Shutting down...');
      await server.getServer().close();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
