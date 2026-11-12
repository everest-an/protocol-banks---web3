import { ChatPromptTemplate } from "@langchain/core/prompts"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ChatOpenAI } from "@langchain/openai"
import { AgentExecutor, createToolCallingAgent } from "langchain/agents"
import { z } from "zod"
import { acceptQuote, createSandboxSession, deliverOrder, listOrders } from "./client"

const session = await createSandboxSession("langchain")
const buyer = session.buyer.key
const seller = session.seller.key

const tools = [
  new DynamicStructuredTool({
    name: "accept_quote",
    description: "Accept an open commerce quote as the buyer.",
    schema: z.object({ quoteId: z.string() }),
    func: async ({ quoteId }) => JSON.stringify(await acceptQuote(buyer, quoteId)),
  }),
  new DynamicStructuredTool({
    name: "deliver_order",
    description: "Record delivery proof as the seller.",
    schema: z.object({ orderId: z.string(), deliveryHash: z.string() }),
    func: async ({ orderId, deliveryHash }) =>
      JSON.stringify(await deliverOrder(seller, orderId, deliveryHash, "https://example.com/sandbox-delivery")),
  }),
  new DynamicStructuredTool({
    name: "list_orders",
    description: "List orders visible to the buyer.",
    schema: z.object({}),
    func: async () => JSON.stringify(await listOrders(buyer)),
  }),
]

const model = new ChatOpenAI({ model: "gpt-4.1-mini", temperature: 0 })
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You operate a sandbox agent-commerce order. Use the tools; never invent ids."],
  ["human", "{input}"],
  ["placeholder", "{agent_scratchpad}"],
])

const agent = createToolCallingAgent({ llm: model, tools, prompt })
const executor = new AgentExecutor({ agent, tools })

const result = await executor.invoke({
  input: `Accept quote ${session.quoteId}, deliver the resulting order with deliveryHash sha256:${"0".repeat(64)}, then list the orders and summarize their status.`,
})

console.log(result.output)
