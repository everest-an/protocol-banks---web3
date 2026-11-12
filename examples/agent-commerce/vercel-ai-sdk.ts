import { generateText, stepCountIs, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { acceptQuote, createSandboxSession, deliverOrder, listOrders } from "./client"

const session = await createSandboxSession("vercel-ai-sdk")
const buyer = session.buyer.key
const seller = session.seller.key

const result = await generateText({
  model: openai("gpt-4.1-mini"),
  tools: {
    accept_quote: tool({
      description: "Accept an open commerce quote as the buyer and create an order.",
      inputSchema: z.object({
        quoteId: z.string().describe("The quote id to accept"),
      }),
      execute: async ({ quoteId }) => acceptQuote(buyer, quoteId),
    }),
    deliver_order: tool({
      description: "Record delivery proof as the seller.",
      inputSchema: z.object({
        orderId: z.string().describe("The order id returned by accept_quote"),
        deliveryHash: z.string().describe("sha256:<64 hex>"),
      }),
      execute: async ({ orderId, deliveryHash }) =>
        deliverOrder(seller, orderId, deliveryHash, "https://example.com/sandbox-delivery"),
    }),
    list_orders: tool({
      description: "List orders visible to the buyer key.",
      inputSchema: z.object({}),
      execute: async () => listOrders(buyer),
    }),
  },
  stopWhen: stepCountIs(6),
  prompt: `Operate this sandbox commerce order.
1. Accept quote ${session.quoteId}.
2. Deliver the resulting order with deliveryHash sha256:${"0".repeat(64)}.
3. List the orders and summarize their status.`,
})

console.log(result.text)
