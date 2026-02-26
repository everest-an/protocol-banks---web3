/**
 * POST /api/mcp
 *
 * MCP Streamable HTTP transport endpoint.
 * Handles MCP JSON-RPC messages over HTTP for web-based AI clients.
 *
 * Authentication is optional — public tools (list_supported_tokens,
 * get_payment_quote) work without auth; authenticated tools require
 * a valid JWT Bearer token.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createMcpServer } from '@/lib/mcp/server'
import { authenticateMcpRequest, type McpAuthContext } from '@/lib/mcp/auth'

export async function POST(request: NextRequest) {
  // Check if MCP is enabled
  if (process.env.MCP_SERVER_ENABLED === 'false') {
    return NextResponse.json(
      { error: 'MCP server is disabled' },
      { status: 503 }
    )
  }

  try {
    // Authenticate (optional — will return unauthenticated context if no token)
    const authHeader = request.headers.get('authorization')
    const authCtx = await authenticateMcpRequest(authHeader)

    // Parse the JSON-RPC request
    const body = await request.json()

    // Create a per-request MCP server
    let currentAuth: McpAuthContext = authCtx
    const server = createMcpServer(() => currentAuth)

    // Handle the JSON-RPC message directly
    // For Streamable HTTP, we process the message and return the response
    const { jsonrpc, method, params, id } = body

    if (jsonrpc !== '2.0' || !method) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: id ?? null,
        },
        { status: 400 }
      )
    }

    // Route to the MCP server's tool/resource handlers
    if (method === 'tools/list') {
      const tools = [
        { name: 'list_supported_tokens', description: 'List all supported tokens and networks.' },
        { name: 'get_payment_quote', description: 'Get a fee estimate for a payment.' },
        { name: 'create_payment', description: 'Create a new payment (auth required).' },
        { name: 'check_payment_status', description: 'Check payment status (auth required).' },
        { name: 'list_payments', description: 'List recent payments (auth required).' },
        { name: 'create_invoice', description: 'Create an invoice (auth required).' },
        { name: 'list_invoices', description: 'List invoices (auth required).' },
        { name: 'get_balance', description: 'Get wallet balances (auth required).' },
      ]
      return NextResponse.json({
        jsonrpc: '2.0',
        result: { tools },
        id,
      })
    }

    if (method === 'resources/list') {
      const resources = [
        { uri: 'protocol-banks://networks', name: 'network-list', description: 'Supported networks' },
        { uri: 'protocol-banks://tokens', name: 'token-list', description: 'Supported tokens' },
      ]
      return NextResponse.json({
        jsonrpc: '2.0',
        result: { resources },
        id,
      })
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {}
      if (!name) {
        return NextResponse.json({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Missing tool name' },
          id,
        })
      }

      try {
        const result = await dispatchToolCall(name, args || {}, authCtx)
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
          id,
        })
      } catch (err) {
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            content: [{ type: 'text', text: `Error: ${(err as Error).message}` }],
            isError: true,
          },
          id,
        })
      }
    }

    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: 'protocol-banks',
            version: '1.0.0',
          },
        },
        id,
      })
    }

    // Unknown method
    return NextResponse.json({
      jsonrpc: '2.0',
      error: { code: -32601, message: `Method not found: ${method}` },
      id,
    })
  } catch (err) {
    console.error('[MCP Route] Error:', err)
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      },
      { status: 500 }
    )
  }
}

// ─── Tool Dispatcher ────────────────────────────────────────────────

async function dispatchToolCall(
  toolName: string,
  args: Record<string, unknown>,
  authCtx: McpAuthContext
): Promise<unknown> {
  // Import handlers lazily to avoid circular dependencies
  const { handleListSupportedTokens, handleGetPaymentQuote } = await import('@/lib/mcp/tools/token-tools')
  const { handleCreatePayment, handleCheckPaymentStatus, handleListPayments } = await import('@/lib/mcp/tools/payment-tools')
  const { handleCreateInvoice, handleListInvoices } = await import('@/lib/mcp/tools/invoice-tools')
  const { handleGetBalance } = await import('@/lib/mcp/tools/balance-tools')

  switch (toolName) {
    case 'list_supported_tokens':
      return handleListSupportedTokens(args as Parameters<typeof handleListSupportedTokens>[0])
    case 'get_payment_quote':
      return handleGetPaymentQuote(args as Parameters<typeof handleGetPaymentQuote>[0])
    case 'create_payment':
      return handleCreatePayment(args as Parameters<typeof handleCreatePayment>[0], authCtx)
    case 'check_payment_status':
      return handleCheckPaymentStatus(args as Parameters<typeof handleCheckPaymentStatus>[0], authCtx)
    case 'list_payments':
      return handleListPayments(args as Parameters<typeof handleListPayments>[0], authCtx)
    case 'create_invoice':
      return handleCreateInvoice(args as Parameters<typeof handleCreateInvoice>[0], authCtx)
    case 'list_invoices':
      return handleListInvoices(args as Parameters<typeof handleListInvoices>[0], authCtx)
    case 'get_balance':
      return handleGetBalance(args as Parameters<typeof handleGetBalance>[0], authCtx)
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}
