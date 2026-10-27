# elizaOS plugin

A v1.x plugin: one provider (account + remaining policy in context) and two
actions — read the account, place an order. Order arguments must arrive as
structured `message.content` fields; this plugin deliberately does not parse
amounts out of prose.

```bash
npm install
PB_KEY=pb_… npm run build
```

Add it to a character (the package is private in this repo — `npm pack` it or
run from a local path until it is published):

```json
{
  "name": "Trader",
  "plugins": ["@everestan/plugin-protocol-banks"],
  "settings": { "secrets": { "PB_KEY": "pb_…" } }
}
```

Then ask: *“What is my Policy?”* or send a message whose content carries
`{ "coin": "BTC", "side": "long", "sizeUsd": 20 }` for `PROTOCOL_BANKS_ORDER`.

Why structured args: an action that guesses a notional from prose can silently
place the wrong size. The server cap still protects the account, but the plugin
refuses to guess.

**Tool-style host?** Use the hosted MCP server
(`https://protocolbanks.com/api/mcp`) — it exposes the same account as tools.
