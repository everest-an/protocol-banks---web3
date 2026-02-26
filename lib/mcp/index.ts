/**
 * MCP Module — Public Exports
 *
 * @module lib/mcp
 */

export { createMcpServer } from './server'
export { authenticateMcpRequest, requireAuth, type McpAuthContext } from './auth'
