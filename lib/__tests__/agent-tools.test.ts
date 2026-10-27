/**
 * The framework-agnostic tool manifest: shape, required fields, and wiring to
 * the SDK. The descriptions are model-facing, so the refusal rule is asserted
 * too — a tool must tell the model not to retry a 403/409 unchanged.
 */
import { ProtocolBanks } from "@protocolbanks/sdk"
import { agentTools, toAnthropicTools, toOpenAIFunctions } from "@protocolbanks/agent-tools"

const pb = new ProtocolBanks({ apiKey: "pb_test", baseUrl: "https://api.test" })

describe("agent-tools", () => {
  const tools = agentTools(pb)

  it("exposes one tool per operation, with JSON Schema parameters", () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      "agent_state",
      "place_order",
      "prepare_payment",
      "prepare_swap",
      "create_invoice",
    ])
    for (const tool of tools) {
      expect(tool.parameters.type).toBe("object")
      expect(tool.parameters.properties).toBeDefined()
      expect(tool.description.length).toBeGreaterThan(40)
    }
  })

  it("marks the required arguments of the executing tool", () => {
    const order = tools.find((tool) => tool.name === "place_order")!
    expect(order.parameters.required).toEqual(["coin", "side", "sizeUsd"])
    const coin = order.parameters.properties.coin as { type: string }
    expect(coin.type).toBe("string")
    const side = order.parameters.properties.side as { enum: string[] }
    expect(side.enum).toEqual(["long", "short"])
    expect(order.description).toMatch(/403/)
  })

  it("only place_order is described as moving money", () => {
    const moving = tools.filter((tool) => /moves money|executes through the account/i.test(tool.description))
    expect(moving.map((tool) => tool.name)).toEqual(["place_order"])
  })

  it("wires execute to the SDK method", async () => {
    const orderSpy = jest.spyOn(pb.agent, "order").mockResolvedValue({ ok: true, status: 200 } as never)
    const invoiceSpy = jest.spyOn(pb.agent, "invoice").mockResolvedValue({ ok: true, status: 200 } as never)

    await tools.find((tool) => tool.name === "place_order")!.execute({ coin: "BTC", side: "long", sizeUsd: 20 })
    await tools.find((tool) => tool.name === "create_invoice")!.execute({ to: "0x" + "1".repeat(40), amount: 25 })

    expect(orderSpy).toHaveBeenCalledWith({ coin: "BTC", side: "long", sizeUsd: 20 })
    expect(invoiceSpy).toHaveBeenCalledWith({ to: "0x" + "1".repeat(40), amount: 25 })
  })

  it("converts to OpenAI and Anthropic tool formats", () => {
    const openai = toOpenAIFunctions(tools)
    expect(openai[0].type).toBe("function")
    expect(openai[0].function.name).toBe("agent_state")
    expect(openai[1].function.parameters).toBe(tools[1].parameters)

    const anthropic = toAnthropicTools(tools)
    expect(anthropic[0].name).toBe("agent_state")
    expect(anthropic[0].input_schema).toBe(tools[0].parameters)
  })
})
