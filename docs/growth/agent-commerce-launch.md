# Agent commerce launch kit (current positioning)

Use this instead of the older trading-only launch copy. The hook is no longer
"an AI trades for you"; it is **"one credential, one server-enforced mandate for
agent commerce."**

## The one-sentence pitch

Protocol Banks lets an agent buy and sell services, pay through x402/EIP-3009,
and trade through a trading-only wallet — under one mandate the server enforces
and the model cannot widen.

## Primary CTA

**Try the sandbox, no wallet:** https://www.protocolbanks.com/sandbox

It issues two disposable keys and a live $1 quote. The buyer accepts, the seller
delivers, and the order is written to the real database. No signup.

## Tracked links

| Channel | Link |
|---|---|
| Product Hunt | `https://www.protocolbanks.com/sandbox?ref=producthunt` |
| Hacker News | `https://www.protocolbanks.com/sandbox?ref=hn` |
| X / Twitter | `https://www.protocolbanks.com/sandbox?ref=x` |
| Reddit | `https://www.protocolbanks.com/sandbox?ref=reddit` |
| MCP directories | `https://www.protocolbanks.com/sandbox?ref=mcp` |
| Smithery | `https://www.protocolbanks.com/sandbox?ref=smithery` |
| mcp.so | `https://www.protocolbanks.com/sandbox?ref=mcpso` |
| Glama | `https://www.protocolbanks.com/sandbox?ref=glama` |
| PulseMCP | `https://www.protocolbanks.com/sandbox?ref=pulsemcp` |
| x402 / PayAI | `https://www.protocolbanks.com/sandbox?ref=x402` |
| Vercel AI SDK | `https://www.protocolbanks.com/sandbox?ref=vercel` |
| LangChain | `https://www.protocolbanks.com/sandbox?ref=langchain` |

The `ref` is stored first-touch and attached to the sandbox key, so
`sandbox_key_created` can be grouped by channel.

---

## Product Hunt

**Name:** Protocol Banks

**Tagline:** One mandate for agent commerce.

**Description:** Your agent can buy and sell services, pay with x402/EIP-3009,
and trade through a trading-only wallet — under a mandate the server enforces.
Try a live order in 30 seconds, no wallet:
https://www.protocolbanks.com/sandbox?ref=producthunt

**Topics:** Artificial Intelligence, Developer Tools, Fintech, Crypto.

**Maker comment:**

Hey Product Hunt! Agents can already browse, reason and call APIs. The missing
piece is commerce: who they are allowed to buy from, what they may spend, and how
a seller proves delivery.

Protocol Banks is the control plane for that:

- Discover services and accept a structured quote.
- Delivery proof is bound to the order by a termsHash.
- Payments use the buyer's own EIP-3009 authorization or x402; the platform never
  holds the balance.
- Trading runs through a Hyperliquid agent wallet with trading-only rights. It
  can place and cancel orders; it cannot withdraw.
- Every key carries a server-enforced mandate: operations, per-call cap, daily
  cap, coin allowlist. The model cannot widen it.

The fastest way to see it: the sandbox issues two disposable keys and a live $1
quote without a wallet. Accept as the buyer, deliver as the seller, then read the
order back. It takes about 30 seconds:
https://www.protocolbanks.com/sandbox?ref=producthunt

Cards are provider-issued through Yativo or Rain and depend on KYB; escrow is not
live yet. Happy to answer anything about the mandate, the order model or the MCP
server.

---

## Hacker News (Show HN)

**Title:** Show HN: Protocol Banks – a server-enforced mandate for agent commerce

**Body:**

Agents can call APIs, but commerce still needs a trust layer: which services they
may buy, how much they may spend, and how a seller proves delivery.

I built Protocol Banks around one credential and one mandate:

- Commerce orders bind seller, buyer, amount, token, delivery terms and a
  termsHash. Delivery proof is attached to the order.
- Payments are non-custodial: the buyer signs an EIP-3009 authorization, or the
  agent pays through x402. The relayer only submits gas.
- Trading uses a Hyperliquid agent wallet with trading-only permissions. It can
  place and cancel orders and cannot withdraw.
- The mandate (operations, per-call cap, daily cap, coin allowlist) is stored on
  the key and enforced server-side. A 403 is final for the request.

There is a no-wallet sandbox that creates two disposable keys and a live $1 quote:
https://www.protocolbanks.com/sandbox?ref=hn

The API is also exposed as an MCP server:
https://www.protocolbanks.com/mcp

I would especially like feedback on the order model (no escrow yet) and the
mandate boundaries. What would you need before letting an agent spend real money?

---

## X / Twitter thread

**1/**

Agents can browse and call APIs. They still cannot safely buy anything.

I built Protocol Banks: one credential, one server-enforced mandate for agent
commerce.

Try a live order in 30 seconds, no wallet:
https://www.protocolbanks.com/sandbox?ref=x

**2/**

What the mandate controls:

- which operations the agent may perform
- per-call cap
- daily cap
- coin allowlist

The policy lives on the key. The model cannot widen it. A refusal is final for
that request.

**3/**

The commerce flow:

quote -> accept -> deliver -> pay -> complete

The order binds seller, amount, token and a termsHash. Delivery proof is attached
to the order, not a separate spreadsheet.

**4/**

Payments are non-custodial.

The buyer signs an EIP-3009 authorization; the relayer pays gas. Agents can also
pay through x402. The platform never holds the balance.

**5/**

Trading is separate and trading-only.

The Hyperliquid agent wallet can place and cancel orders. It cannot withdraw.
Worst case is the budget you funded, not the account.

**6/**

The fastest way to see it:

1. open protocolbanks.com/sandbox
2. get a buyer key and a seller key
3. accept the $1 quote
4. deliver the order

No signup, no wallet, 24-hour keys.

---

## Reddit

### r/AI_Agents

**Title:** I built a server-enforced mandate for agents that buy and sell services

**Body:**

Most "agent payments" demos stop at "the agent has a private key." That is not a
control model.

Protocol Banks gives an agent one credential with a policy the server enforces:
allowed operations, per-call cap, daily cap and a coin allowlist. Commerce orders
bind the seller, amount, token, delivery terms and a termsHash. The buyer pays
with their own EIP-3009 authorization or x402; the platform never holds the
balance.

There is a no-wallet sandbox that creates two keys and a live $1 quote. The buyer
accepts, the seller delivers, the order is written to the real database:
https://www.protocolbanks.com/sandbox?ref=reddit

I would like feedback on the order model. Escrow is not live yet; today the buyer
pays the seller directly after delivery proof.

### r/mcp

**Title:** Protocol Banks MCP server: commerce, payments and a trading-only wallet

**Body:**

The MCP server exposes 23 tools: discover services, create/accept a quote, record
delivery proof, list orders, read seller reputation, plus payments and a
trading-only Hyperliquid wallet.

The interesting part is not the tool count. It is that every key carries a
server-enforced mandate: operations, per-call cap, daily cap, coin allowlist. The
model cannot widen it.

Hosted endpoint: https://www.protocolbanks.com/api/mcp
Setup: https://www.protocolbanks.com/mcp
No-wallet sandbox: https://www.protocolbanks.com/sandbox?ref=mcp

### r/LangChain and r/vercel

**Title:** Runnable template: an agent that accepts a quote and delivers an order

**Body:**

I added two runnable templates for Protocol Banks agent commerce:

- Vercel AI SDK: `generateText` + three tools + a multi-step stop condition.
- LangChain: `createToolCallingAgent` + `AgentExecutor`.

Both create a disposable sandbox session, accept a $1 quote, deliver as the
seller and list the order. No wallet, no signup:
https://www.protocolbanks.com/sandbox?ref=langchain

Code: `examples/agent-commerce/` in the repo.

### r/ethdev

**Title:** Non-custodial agent commerce: EIP-3009 + order-bound termsHash

**Body:**

I am building the control plane for agent commerce. The payment path is
non-custodial: the buyer signs an EIP-3009 authorization, the relayer submits it
and pays gas. Commerce orders bind the seller, amount, token, delivery terms and
a termsHash, so payment is tied to a specific order.

No escrow yet. I would appreciate feedback on the authorization flow and the
order-binding model:
https://www.protocolbanks.com/sandbox?ref=reddit

---

## x402 / PayAI / Coinbase CDP / Cloudflare Agents

Short post for the x402 ecosystem:

> We added x402 to Protocol Banks agent commerce. An agent can discover a
> service, accept a quote, deliver proof, and pay through x402 or a signed
> EIP-3009 authorization. The platform is non-custodial; the relayer only submits
> gas. Free no-wallet sandbox: https://www.protocolbanks.com/sandbox?ref=x402

Lead with the sandbox, not a token pitch. Offer a 15-minute integration call for
the first five x402 sellers.

---

## Seven-day execution

**Day 1:** Publish the official MCP registry listing, then Smithery and mcp.so.
Verify `initialize` and the tool list before submitting.

**Day 2:** Submit Glama and PulseMCP. Open the awesome-mcp-servers PR. Post the
x402/PayAI message.

**Day 3:** Publish the Vercel AI SDK template and the LangChain template. Post to
r/LangChain and r/vercel.

**Day 4:** Product Hunt launch. X thread at the same time. Reply to every comment
for two hours.

**Day 5:** Show HN. Do not cross-post the same text; use the HN version.

**Day 6:** Reddit r/AI_Agents and r/mcp. Answer questions; do not drop links in
unrelated threads.

**Day 7:** Review `sandbox_view`, `sandbox_key_created`, `agents_view`,
`api_key_created` and `agent_op` by `source`. Double down on the one channel that
produced activated keys, not the one that produced clicks.

## Kill criteria

- Fewer than 10% of sandbox viewers create keys: fix the page copy, not the ads.
- Keys created but no quote accepted: the flow is too long; shorten it.
- Quote accepted but no delivery: the seller side is unclear; add a one-click
  seller command.
- Traffic but no second session: the product is a demo, not a workflow; talk to
  five users before adding another channel.

## Honest numbers

A cold launch does not produce a million users in three days. A good Product Hunt
day is hundreds to low thousands of visits; the useful outcome is 20-50 activated
sandbox keys and 5 design partners. Those are the numbers that compound.
