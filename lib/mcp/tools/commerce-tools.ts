import { z } from "zod"
import type { McpAuthContext } from "../auth"
import { requireAuth } from "../auth"
import {
  acceptQuote,
  completeOrder,
  createQuote,
  deliverOrder,
  getReputation,
  listOrders,
  listServices,
} from "@/lib/agent/commerce"

export const listAgentServicesTool = {
  name: "list_agent_services",
  description: "List public agent services with price, token, chain and category.",
  inputSchema: {
    type: "object" as const,
    properties: {
      category: { type: "string", description: "Filter by category." },
      q: { type: "string", description: "Search the service name." },
      limit: { type: "number", description: "Maximum results (default 50, max 100)." },
    },
  },
}

export const createCommerceQuoteTool = {
  name: "create_commerce_quote",
  description: "Seller: create a structured quote for a service. Returns a terms hash. Requires authentication.",
  inputSchema: {
    type: "object" as const,
    properties: {
      serviceId: { type: "string", description: "Service listing id." },
      buyer: { type: "string", description: "Buyer wallet address." },
      scope: { type: "string", description: "What will be delivered." },
      amountUsd: { type: "number", description: "Optional negotiated amount; defaults to the service price." },
      deliveryDue: { type: "string", description: "Optional ISO delivery deadline." },
      terms: { type: "object", description: "Optional refund, dispute and SLA terms." },
      expiresInSeconds: { type: "number", description: "Quote validity (60-604800)." },
    },
    required: ["serviceId", "buyer", "scope"],
  },
}

export const acceptCommerceQuoteTool = {
  name: "accept_commerce_quote",
  description: "Buyer: accept a quote and create an order. Requires authentication.",
  inputSchema: {
    type: "object" as const,
    properties: { quoteId: { type: "string", description: "Quote id." } },
    required: ["quoteId"],
  },
}

export const deliverCommerceOrderTool = {
  name: "deliver_commerce_order",
  description: "Seller: record delivery proof for an order. Requires authentication.",
  inputSchema: {
    type: "object" as const,
    properties: {
      orderId: { type: "string", description: "Order id." },
      deliveryHash: { type: "string", description: "sha256 hash or 0x hash of the delivery." },
      deliveryUri: { type: "string", description: "Optional delivery location." },
      deliverySignature: { type: "string", description: "Optional seller signature over the delivery proof." },
    },
    required: ["orderId", "deliveryHash"],
  },
}

export const completeCommerceOrderTool = {
  name: "complete_commerce_order",
  description: "Buyer: confirm a paid, delivered order. Requires authentication.",
  inputSchema: {
    type: "object" as const,
    properties: { orderId: { type: "string", description: "Order id." } },
    required: ["orderId"],
  },
}

export const listCommerceOrdersTool = {
  name: "list_commerce_orders",
  description: "List commerce orders where the authenticated wallet is buyer or seller.",
  inputSchema: {
    type: "object" as const,
    properties: { id: { type: "string", description: "Optional order id." } },
  },
}

export const getAgentReputationTool = {
  name: "get_agent_reputation",
  description: "Read a seller's completed, disputed and refunded order counts and volume.",
  inputSchema: {
    type: "object" as const,
    properties: { address: { type: "string", description: "Seller wallet address." } },
    required: ["address"],
  },
}

export async function handleListAgentServices(args: { category?: string; q?: string; limit?: number }) {
  return { services: await listServices(args) }
}

export async function handleCreateCommerceQuote(args: Record<string, unknown>, authCtx: McpAuthContext) {
  return { quote: await createQuote(requireAuth(authCtx), args) }
}

export async function handleAcceptCommerceQuote(args: { quoteId: string }, authCtx: McpAuthContext) {
  return { order: await acceptQuote(requireAuth(authCtx), args.quoteId) }
}

export async function handleDeliverCommerceOrder(args: Record<string, unknown>, authCtx: McpAuthContext) {
  const orderId = String(args.orderId ?? "")
  return { order: await deliverOrder(requireAuth(authCtx), orderId, args) }
}

export async function handleCompleteCommerceOrder(args: { orderId: string }, authCtx: McpAuthContext) {
  return { order: await completeOrder(requireAuth(authCtx), args.orderId) }
}

export async function handleListCommerceOrders(args: { id?: string }, authCtx: McpAuthContext) {
  const address = requireAuth(authCtx)
  if (args.id) {
    const orders = await listOrders(address)
    return { orders: orders.filter((order) => order.id === args.id) }
  }
  return { orders: await listOrders(address) }
}

export async function handleGetAgentReputation(args: { address: string }) {
  return { reputation: await getReputation(args.address) }
}

export const listAgentServicesSchema = {
  category: z.string().optional().describe("Filter by category."),
  q: z.string().optional().describe("Search the service name."),
  limit: z.number().int().min(1).max(100).optional().describe("Maximum results."),
}

export const createCommerceQuoteSchema = {
  serviceId: z.string().describe("Service listing id."),
  buyer: z.string().describe("Buyer wallet address."),
  scope: z.string().describe("What will be delivered."),
  amountUsd: z.number().positive().optional().describe("Optional negotiated amount."),
  deliveryDue: z.string().optional().describe("Optional ISO delivery deadline."),
  terms: z.record(z.unknown()).optional().describe("Optional refund, dispute and SLA terms."),
  expiresInSeconds: z.number().int().min(60).max(604800).optional().describe("Quote validity."),
}

export const acceptCommerceQuoteSchema = {
  quoteId: z.string().describe("Quote id."),
}

export const deliverCommerceOrderSchema = {
  orderId: z.string().describe("Order id."),
  deliveryHash: z.string().describe("sha256 hash or 0x hash of the delivery."),
  deliveryUri: z.string().optional().describe("Optional delivery location."),
  deliverySignature: z.string().optional().describe("Optional seller signature over the delivery proof."),
}

export const completeCommerceOrderSchema = {
  orderId: z.string().describe("Order id."),
}

export const listCommerceOrdersSchema = {
  id: z.string().optional().describe("Optional order id."),
}

export const getAgentReputationSchema = {
  address: z.string().describe("Seller wallet address."),
}
