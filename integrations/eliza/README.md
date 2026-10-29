# elizaOS plugin

A v1.x plugin: one provider (account + remaining policy in context) and two
actions — read the account, place an order. Order arguments must arrive as
structured `message.content` fields; this plugin deliberately does not parse
amounts out of prose.

```bash
npm install
npm test        # vitest: shape, refusals, fill reporting, provider
npm run build   # tsc -> dist (ESM + d.ts)
```

Add it to a character (published as `@everestan/plugin-protocol-banks` on npm):

```json
{
  "name": "Trader",
  "plugins": ["@everestan/plugin-protocol-banks"],
  "settings": { "secrets": { "PB_KEY": "pb_…" } }
}
```

Then ask: *“What is my policy?”* or send a message whose content carries
`{ "coin": "BTC", "side": "long", "sizeUsd": 20 }` for `PROTOCOL_BANKS_ORDER`.

Why structured args: an action that guesses a notional from prose can silently
place the wrong size. The server cap still protects the account, but the plugin
refuses to guess.

## Publish (elizaOS registry)

Published: https://www.npmjs.com/package/@everestan/plugin-protocol-banks (0.1.1).

**Registry submission is blocked on the elizaOS side.** Their docs point at
`github.com/elizaos-plugins/registry`, but that repository returns 404 and the
`elizaos-plugins` org has zero public repos (checked 2026-10-28), so
`elizaos publish` has nowhere to open its pull request. The npm package is
installable by name today; when the registry is restored, run:

```bash
npm run build
npx elizaos publish
```

The registry requires `images/logo.jpg` (400×400) and `images/banner.jpg`
(1280×640) — both are committed here. `npm run build` runs on `prepublishOnly`,
so the tarball always carries `dist/`.

**Tool-style host?** Use the hosted MCP server
(`https://protocolbanks.com/api/mcp`, in the official MCP Registry) — it
exposes the same account as tools.
