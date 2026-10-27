# Vercel AI SDK

```bash
npm install
PB_KEY=pb_… OPENAI_API_KEY=sk-… npm run dev
npm run dev -- "What is my equity and policy? Then place a $20 BTC long."
```

`index.ts` builds the five tools from the manifest (`agentTools`) with
`jsonSchema()`, then runs one `generateText` call. On AI SDK v4 the tool schema
field is `parameters` and the loop limit is `maxSteps`; the manifest is the same.

What the model sees: `agent_state`, `place_order`, `prepare_payment`,
`prepare_swap`, `create_invoice`. Only `place_order` moves money; a refusal is
returned as `{ ok: false, status: 403|409, error }` and must not be retried
unchanged.
