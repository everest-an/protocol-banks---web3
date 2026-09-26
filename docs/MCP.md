# MCP Server — Control Your Trading Agent from Claude / Any MCP Host

Protocol Bank ships a **Model Context Protocol (MCP)** server so AI assistants
(Claude Desktop, Claude Code, or any MCP-compatible host) can read and control
your AI trading agent — no browser required.

Ask your assistant things like:

> "How is my trading agent doing?"
> "What positions is the agent holding right now?"
> "Why did it open the SOL short?"
> "Pause the agent — I don't like this market."

## Quick start (stdio)

```bash
pnpm mcp:stdio
# or
npx tsx lib/mcp/stdio-server.ts
```

The process speaks MCP over stdio (stdout = protocol, stderr = logs).

## Connect from Claude Desktop

Add this to your Claude Desktop config
(`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS,
`%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "protocol-bank": {
      "command": "npx",
      "args": ["tsx", "lib/mcp/stdio-server.ts"],
      "cwd": "/absolute/path/to/protocol-bank",
      "env": {
        "MCP_AUTH_TOKEN": "<your SIWE JWT>",
        "MCP_WALLET_ADDRESS": "0xYourWalletAddress"
      }
    }
  }
}
```

Restart Claude Desktop — the tools appear under the 🔌 icon.

## Connect from Claude Code

```bash
claude mcp add protocol-bank -- npx tsx lib/mcp/stdio-server.ts
```

## Authentication

| Mode | Required env | What it can do |
|---|---|---|
| **Guest (no auth)** | — | Read the guest demo paper account + public track record |
| **Authenticated** | `MCP_AUTH_TOKEN` (SIWE JWT) + `MCP_WALLET_ADDRESS` | Read **your own** paper account and control your agent |

`MCP_AUTH_TOKEN` is the SIWE-issued JWT from a wallet sign-in. It is only read
from the environment — the MCP server never asks for or stores a private key.

## Tools

### Trading (the main surface)

| Tool | Auth | Description |
|---|---|---|
| `get_trading_overview` | optional | Agent status, equity, trading wallet, max loss, today/all-time PnL, position count |
| `get_positions` | optional | Open positions: side, leverage, entry/mark, size, unrealized PnL, plain-language reason |
| `get_activity` | optional | Activity feed (scans, opens/closes with PnL, risk-guard events), `limit` 1–50 |
| `get_track_record` | none | Public anonymized live-account performance (same data as `/live-track-record`) |
| `control_trading_agent` | **required** | `pause` / `resume` / `stop` the agent |

### Legacy payments (kept for the Business suite)

`list_supported_tokens`, `get_payment_quote`, `estimate_gas`, `compare_chain_fees`,
`create_payment`, `check_payment_status`, `list_payments`, `create_invoice`,
`list_invoices`, `get_balance`, `execute_payment`.

## Example session

```
You:  How is my trading agent doing?
Bot:  Your agent is running. Equity $499.91, trading wallet $499.91 (max loss
      $499.91). Today −$0.09 (−0.02%), all-time −$0.09. 3 open positions.

You:  What's it holding?
Bot:  Shorts: FARTCOIN −$0.01, XRP +$0.02, TAO +$0.04 — all opened on
      "momentum z < −1.5, funding +0.001%/h, short bias".

You:  Pause it, the funding is about to flip.
Bot:  Paused. No new trades will open; existing positions are still managed.
```

## Safety properties

- **Read-only by default.** Without a JWT the server can only read public and
  guest-demo data.
- **No key material.** The MCP server never holds a wallet private key; control
  actions mutate agent state only, never move funds.
- **Trading-only.** Even fully authenticated, nothing here can withdraw — that
  is enforced by the agent wallet's on-chain permissions, not by this server.
- **Pause ≠ exit.** `pause` stops new entries but keeps managing open
  positions (stop-losses stay live). Use `stop` for a full halt.

## Troubleshooting

| Symptom | Fix |
|---|---|
| No tools appear | Check `cwd` is the repo root; run `pnpm mcp:stdio` manually to see stderr |
| `Authentication required` | Set `MCP_AUTH_TOKEN` + `MCP_WALLET_ADDRESS`, restart the host |
| Track record returns an error | The DB may be unreachable from your machine — it uses the same `DATABASE_URL` as the app |
