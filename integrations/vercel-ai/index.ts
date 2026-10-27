/**
 * Vercel AI SDK + Protocol Banks Agent API.
 *
 *   npm install
 *   PB_KEY=pb_… OPENAI_API_KEY=sk-… npm run dev
 *
 * The five tools come from the JSON-Schema manifest; the server enforces the
 * key's policy, so the model can ask for anything and still cannot exceed the
 * per-call or daily cap.
 */
import { generateText, jsonSchema, stepCountIs, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { ProtocolBanks } from "@everestan/protocolbanks-sdk"
import { agentTools } from "@everestan/protocolbanks-agent-tools"

const pb = new ProtocolBanks({ apiKey: process.env.PB_KEY ?? "" })

export const tools = Object.fromEntries(
  agentTools(pb).map((definition) => [
    definition.name,
    tool({
      description: definition.description,
      // The manifest is JSON Schema; the AI SDK accepts it through jsonSchema().
      inputSchema: jsonSchema<Record<string, unknown>>(definition.parameters as never),
      execute: (args) => definition.execute(args),
    }),
  ]),
)

export async function run(prompt: string) {
  return generateText({
    model: openai(process.env.MODEL ?? "gpt-4.1"),
    tools,
    stopWhen: stepCountIs(6),
    prompt,
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prompt =
    process.argv.slice(2).join(" ") ||
    "Read my policy, then place a $20 BTC long. If the server refuses it, stop and quote the refusal."
  run(prompt)
    .then((result) => console.log(result.text))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
