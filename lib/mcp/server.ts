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
  estimateGasTool,
  compareChainFeesTool,
  executePaymentTool,
  handleCreatePayment,
  handleCheckPaymentStatus,
  handleListPayments,
  handleEstimateGas,
  handleCompareChainFees,
  handleExecutePayment,
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
  listAgentServicesTool,
  createCommerceQuoteTool,
  acceptCommerceQuoteTool,
  deliverCommerceOrderTool,
  completeCommerceOrderTool,
  listCommerceOrdersTool,
  getAgentReputationTool,
  listAgentServicesSchema,
  createCommerceQuoteSchema,
  acceptCommerceQuoteSchema,
  deliverCommerceOrderSchema,
  completeCommerceOrderSchema,
  listCommerceOrdersSchema,
  getAgentReputationSchema,
  handleListAgentServices,
  handleCreateCommerceQuote,
  handleAcceptCommerceQuote,
  handleDeliverCommerceOrder,
  handleCompleteCommerceOrder,
  handleListCommerceOrders,
  handleGetAgentReputation,
} from './tools/commerce-tools'

import {
  getTradingOverviewTool,
  getPositionsTool,
  getActivityTool,
  controlTradingAgentTool,
  getTrackRecordTool,
  getActivitySchema,
  controlTradingAgentSchema,
  handleGetTradingOverview,
  handleGetPositions,
  handleGetActivity,
  handleControlTradingAgent,
  handleGetTrackRecord,
} from './tools/trading-tools'

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

  server.tool(
    estimateGasTool.name,
    estimateGasTool.description,
    estimateGasTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleEstimateGas(args as Parameters<typeof handleEstimateGas>[0])
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    compareChainFeesTool.name,
    compareChainFeesTool.description,
    compareChainFeesTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleCompareChainFees(args as Parameters<typeof handleCompareChainFees>[0])
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

  server.tool(
    executePaymentTool.name,
    executePaymentTool.description,
    executePaymentTool.inputSchema.properties as Record<string, unknown>,
    async (args) => {
      try {
        const result = await handleExecutePayment(args as Parameters<typeof handleExecutePayment>[0], getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  // ─── AI Trading Tools ───────────────────────────────────────────
  // Registered with registerTool + zod schemas so arguments are parsed
  // and validated (the legacy tool() overload treated JSON-schema fragments
  // as annotations and silently dropped arguments).

  server.registerTool(
    getTradingOverviewTool.name,
    { title: getTradingOverviewTool.title, description: getTradingOverviewTool.description },
    async () => {
      try {
        const result = await handleGetTradingOverview(getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    getPositionsTool.name,
    { title: getPositionsTool.title, description: getPositionsTool.description },
    async () => {
      try {
        const result = await handleGetPositions(getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    getActivityTool.name,
    { title: getActivityTool.title, description: getActivityTool.description, inputSchema: getActivitySchema },
    async (args) => {
      try {
        const result = await handleGetActivity(args as { limit?: number }, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    getTrackRecordTool.name,
    { title: getTrackRecordTool.title, description: getTrackRecordTool.description },
    async () => {
      try {
        const result = await handleGetTrackRecord()
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    controlTradingAgentTool.name,
    { title: controlTradingAgentTool.title, description: controlTradingAgentTool.description, inputSchema: controlTradingAgentSchema },
    async (args) => {
      try {
        const result = await handleControlTradingAgent(args as { action: 'pause' | 'resume' | 'stop' }, getAuthContext())
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

  server.registerTool(
    listAgentServicesTool.name,
    { title: listAgentServicesTool.name, description: listAgentServicesTool.description, inputSchema: listAgentServicesSchema },
    async (args) => {
      try {
        const result = await handleListAgentServices(args as { category?: string; q?: string; limit?: number })
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    getAgentReputationTool.name,
    { title: getAgentReputationTool.name, description: getAgentReputationTool.description, inputSchema: getAgentReputationSchema },
    async (args) => {
      try {
        const result = await handleGetAgentReputation(args as { address: string })
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    createCommerceQuoteTool.name,
    { title: createCommerceQuoteTool.name, description: createCommerceQuoteTool.description, inputSchema: createCommerceQuoteSchema },
    async (args) => {
      try {
        const result = await handleCreateCommerceQuote(args as Record<string, unknown>, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    acceptCommerceQuoteTool.name,
    { title: acceptCommerceQuoteTool.name, description: acceptCommerceQuoteTool.description, inputSchema: acceptCommerceQuoteSchema },
    async (args) => {
      try {
        const result = await handleAcceptCommerceQuote(args as { quoteId: string }, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    deliverCommerceOrderTool.name,
    { title: deliverCommerceOrderTool.name, description: deliverCommerceOrderTool.description, inputSchema: deliverCommerceOrderSchema },
    async (args) => {
      try {
        const result = await handleDeliverCommerceOrder(args as Record<string, unknown>, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    completeCommerceOrderTool.name,
    { title: completeCommerceOrderTool.name, description: completeCommerceOrderTool.description, inputSchema: completeCommerceOrderSchema },
    async (args) => {
      try {
        const result = await handleCompleteCommerceOrder(args as { orderId: string }, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.registerTool(
    listCommerceOrdersTool.name,
    { title: listCommerceOrdersTool.name, description: listCommerceOrdersTool.description, inputSchema: listCommerceOrdersSchema },
    async (args) => {
      try {
        const result = await handleListCommerceOrders(args as { id?: string }, getAuthContext())
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Error: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  return server
}
