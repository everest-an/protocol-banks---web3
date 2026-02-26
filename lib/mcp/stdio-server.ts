#!/usr/bin/env node
/**
 * MCP stdio Transport Server
 *
 * Entry point for running the Protocol Banks MCP server via stdio transport.
 * Used by Claude Desktop, Claude CLI, and other MCP clients.
 *
 * Usage:
 *   pnpm mcp:stdio
 *   # or
 *   node -r tsconfig-paths/register -r ts-node/register lib/mcp/stdio-server.ts
 *
 * @module lib/mcp/stdio-server
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './server'
import type { McpAuthContext } from './auth'

async function main() {
  // For stdio transport, auth is provided via environment variable
  const jwtToken = process.env.MCP_AUTH_TOKEN

  const authContext: McpAuthContext = jwtToken
    ? { authenticated: true, address: process.env.MCP_WALLET_ADDRESS }
    : { authenticated: false }

  const server = createMcpServer(() => authContext)
  const transport = new StdioServerTransport()

  await server.connect(transport)

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error('[MCP] Protocol Banks MCP server started (stdio transport)')
}

main().catch((err) => {
  console.error('[MCP] Fatal error:', err)
  process.exit(1)
})
