/**
 * MCP Server Factory
 *
 * Creates and configures the Protocol Banks MCP server with
 * all available tools and resources registered.
 *
 * @module lib/mcp/server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpAuthContext } from './auth'

// Tool definitions & handlers
import {
  listSupportedTokensTool,
  getPaymentQuoteTool,
  handleListSupportedTokens,
  handleGetPaymentQuote,
} from './tools/token-tools'

import {
  createPaymentTool,
  checkPaymentStatusTool,
  listPaymentsTool,
  handleCreatePayment,
  handleCheckPaymentStatus,
  handleListPayments,
} from './tools/payment-tools'

import {
  createInvoiceTool,
  listInvoicesTool,
  handleCreateInvoice,
  handleListInvoices,
} from './tools/invoice-tools'

import {
  getBalanceTool,
  handleGetBalance,
} from './tools/balance-tools'

import {
  networkListResource,
  handleNetworkListResource,
  tokenListResource,
  handleTokenListResource,
} from './resources'

/**
 * Create a configured MCP server instance.
 * The auth context is injected per-request by the transport layer.
 */
export function createMcpServer(getAuthContext: () => McpAuthContext) {
  const server = new McpServer({
    name: 'protocol-banks',
    version: '1.0.0',
  })

  // ─── Public Tools (no auth) ─────────────────────────────────────

  server.tool(
    listSupportedTokensTool.name,
    listSupportedTokensTool.description,
    listSupportedTokensTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      const result = await handleListSupportedTokens(args as Record<string, unknown>)
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    getPaymentQuoteTool.name,
    getPaymentQuoteTool.description,
    getPaymentQuoteTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleGetPaymentQuote(args as { network: string; token: string; amount: string })
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  // ─── Authenticated Tools ────────────────────────────────────────

  server.tool(
    createPaymentTool.name,
    createPaymentTool.description,
    createPaymentTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleCreatePayment(args as Record<string, unknown> as Parameters<typeof handleCreatePayment>[0], getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    checkPaymentStatusTool.name,
    checkPaymentStatusTool.description,
    checkPaymentStatusTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleCheckPaymentStatus(args as { payment_id: string }, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    listPaymentsTool.name,
    listPaymentsTool.description,
    listPaymentsTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleListPayments(args as Record<string, unknown> as Parameters<typeof handleListPayments>[0], getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    createInvoiceTool.name,
    createInvoiceTool.description,
    createInvoiceTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleCreateInvoice(args as Record<string, unknown> as Parameters<typeof handleCreateInvoice>[0], getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    listInvoicesTool.name,
    listInvoicesTool.description,
    listInvoicesTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleListInvoices(args as Record<string, unknown> as Parameters<typeof handleListInvoices>[0], getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    getBalanceTool.name,
    getBalanceTool.description,
    getBalanceTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleGetBalance(args as { network?: string; token?: string }, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  // ─── Resources ──────────────────────────────────────────────────

  server.resource(
    networkListResource.name,
    networkListResource.uri,
    networkListResource.metadata,
    async () => {
      const data = await handleNetworkListResource()
      return { contents: [{ uri: networkListResource.uri, text: JSON.stringify(data, null, 2), mimeType: 'application/json' }] }
    }
  )

  server.resource(
    tokenListResource.name,
    tokenListResource.uri,
    tokenListResource.metadata,
    async () => {
      const data = await handleTokenListResource()
      return { contents: [{ uri: tokenListResource.uri, text: JSON.stringify(data, null, 2), mimeType: 'application/json' }] }
    }
  )

  return server
}
