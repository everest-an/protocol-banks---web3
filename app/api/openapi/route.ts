/**
 * GET /api/openapi
 *
 * Returns a lightweight OpenAPI 3.1 spec for AI agent consumption.
 * AI models can read this to understand available endpoints.
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.protocolbanks.com'

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Protocol Banks API',
      version: '2.0.0',
      description:
        'AI-native stablecoin payment infrastructure. Supports USDC/USDT across Ethereum, Base, Polygon, Arbitrum, Optimism, and TRON.',
      contact: { url: baseUrl },
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/.well-known/agent.json': {
        get: {
          summary: 'ERC-8004 Agent Card',
          description: 'Returns the platform Agent Card for AI agent discovery.',
          responses: { '200': { description: 'Agent Card JSON' } },
          tags: ['Discovery'],
        },
      },
      '/api/auth/siwe/nonce': {
        get: {
          summary: 'Get SIWE nonce',
          description: 'Returns a one-time nonce for Sign-In with Ethereum.',
          responses: { '200': { description: '{ nonce: string }' } },
          tags: ['Authentication'],
        },
      },
      '/api/auth/siwe/verify': {
        post: {
          summary: 'Verify SIWE signature',
          description:
            'Verifies an EIP-4361 signed message and returns JWT tokens.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message', 'signature'],
                  properties: {
                    message: { type: 'string', description: 'EIP-4361 SIWE message' },
                    signature: { type: 'string', description: 'EIP-191 signature (0x...)' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: '{ accessToken, refreshToken, expiresAt }',
            },
          },
          tags: ['Authentication'],
        },
      },
      '/api/auth/siwe/refresh': {
        post: {
          summary: 'Refresh JWT',
          description: 'Exchange a refresh token for a new access token.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refreshToken'],
                  properties: {
                    refreshToken: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: '{ accessToken, expiresAt }' } },
          tags: ['Authentication'],
        },
      },
      '/api/mcp': {
        post: {
          summary: 'MCP Server (Streamable HTTP)',
          description:
            '8 payment tools: list_supported_tokens, get_payment_quote, create_payment, check_payment_status, list_payments, create_invoice, list_invoices, get_balance.',
          security: [{ bearerAuth: [] }],
          tags: ['MCP'],
        },
      },
      '/api/a2a': {
        post: {
          summary: 'A2A Protocol Endpoint',
          description:
            'Agent-to-Agent JSON-RPC 2.0 messaging with EIP-191 signatures. Methods: handshake, requestPayment, confirmPayment, paymentStatus.',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['jsonrpc', 'method', 'params'],
                  properties: {
                    jsonrpc: { type: 'string', enum: ['2.0'] },
                    id: { type: 'string' },
                    method: {
                      type: 'string',
                      enum: [
                        'a2a.handshake',
                        'a2a.requestPayment',
                        'a2a.confirmPayment',
                        'a2a.paymentStatus',
                      ],
                    },
                    params: { type: 'object' },
                  },
                },
              },
            },
          },
          tags: ['A2A'],
        },
      },
      '/api/payments': {
        post: {
          summary: 'Create Payment',
          description: 'Send a stablecoin payment.',
          security: [{ bearerAuth: [] }, { apiKey: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to', 'amount', 'token'],
                  properties: {
                    to: { type: 'string', description: 'Recipient wallet address' },
                    amount: { type: 'string', description: 'Amount (e.g. "100")' },
                    token: { type: 'string', enum: ['USDC', 'USDT', 'DAI'] },
                    chain: {
                      type: 'string',
                      enum: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism', 'tron'],
                      default: 'base',
                    },
                    memo: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Payment created' } },
          tags: ['Payments'],
        },
      },
      '/api/agents': {
        post: {
          summary: 'Create AI Agent',
          description: 'Create a new AI agent and receive an API key.',
          security: [{ bearerAuth: [] }],
          tags: ['Agents'],
        },
        get: {
          summary: 'List AI Agents',
          description: 'List agents owned by the authenticated user.',
          security: [{ bearerAuth: [] }],
          tags: ['Agents'],
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT obtained via SIWE authentication',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'Agent API key (pb_sk_xxx)',
        },
      },
    },
  }

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  })
}
