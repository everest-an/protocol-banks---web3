# Mastra

```bash
npm install
PB_KEY=pb_… OPENAI_API_KEY=sk-… npm run dev
npm run dev -- "What is my policy? Then place a $20 BTC long."
```

- `src/tools.ts` — five `createTool` definitions (`agent_state`, `place_order`,
  `prepare_payment`, `prepare_swap`, `create_invoice`). Mastra 1.x passes the
  validated input as `execute(inputData, context)`.
- `src/agent.ts` — a ready `Agent` with instructions that make the refusal rule
  explicit; drop it into an existing Mastra project (`mastra dev`) as-is.
- `src/run.ts` — a standalone one-shot so the example works without a server.

`place_order` sets `outputValidation: "warn"`: the order has already executed by
the time the result is validated, so a schema mismatch must not make the model
retry it.
