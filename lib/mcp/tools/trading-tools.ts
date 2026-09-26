/**
 * MCP Trading Tools
 *
 * Exposes the AI trading cockpit to MCP clients (Claude Desktop / Claude
 * Code / any MCP host): read the agent's state, follow its activity feed,
 * and pause / resume / stop it — all without opening a browser.
 *
 * Auth model:
 * - `get_trading_overview`, `get_positions`, `get_activity`, `get_track_record`
 *   work without auth (guest demo account / public track record).
 * - When a JWT is configured (MCP_AUTH_TOKEN / MCP_WALLET_ADDRESS), the same
 *   tools read the caller's own account instead of the guest demo.
 * - `control_trading_agent` REQUIRES authentication.
 *
 * @module lib/mcp/tools/trading-tools
 */

import type { McpAuthContext } from '../auth'
import { requireAuth } from '../auth'
import { z } from 'zod'

// ─── Tool Definitions (zod schemas — the SDK's registerTool format) ──

export const getActivitySchema = {
  limit: z.number().int().min(1).max(50).optional().describe(
    'Maximum number of activity items to return (default 10, max 50).',
  ),
}

export const controlTradingAgentSchema = {
  action: z.enum(['pause', 'resume', 'stop']).describe('The control action to perform.'),
}

export const getTradingOverviewTool = {
  name: 'get_trading_overview',
  title: 'Get AI trading overview',
  description:
    'Get the AI trading cockpit state: agent status (running/paused/stopped), total equity, trading wallet, max loss, today/all-time PnL, open positions and the latest activity. Without a configured wallet this reads the guest demo account (paper mode).',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
}

export const getPositionsTool = {
  name: 'get_positions',
  title: 'Get open positions',
  description:
    'List the AI agent\'s open positions with side, leverage, entry/mark price, size, unrealized PnL and the plain-language reason the position was opened.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
}

export const getActivityTool = {
  name: 'get_activity',
  title: 'Get AI activity feed',
  description:
    'Read the AI agent\'s recent activity feed in plain language: market scans, position opens/closes (with PnL), and risk-guard events.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of activity items to return (default 10, max 50).',
      },
    },
  },
}

export const controlTradingAgentTool = {
  name: 'control_trading_agent',
  title: 'Control the AI trading agent',
  description:
    'Control the AI trading agent. Actions: "pause" (stop opening new trades, keep managing positions), "resume" (start scanning again), "stop" (emergency stop — halt everything). Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['pause', 'resume', 'stop'],
        description: 'The control action to perform.',
      },
    },
    required: ['action'],
  },
}

export const getTrackRecordTool = {
  name: 'get_track_record',
  title: 'Get public live track record',
  description:
    'Get the public, anonymized live track record: every live Protocol Bank account with its budget, realized PnL and trade count. No auth required — this is public data.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
  },
}

// ─── Handlers ───────────────────────────────────────────────────────

/** Load the trading agent for the caller (or the guest demo) and tick it. */
async function loadOverview(authCtx: McpAuthContext) {
  const { getAgentForWallet } = await import('@/lib/trading/agent')
  const wallet = authCtx.authenticated && authCtx.address ? authCtx.address : null
  const agent = getAgentForWallet(wallet)

  // Hydrate per-user paper state from the DB when available (same as the API route).
  if (wallet) {
    try {
      const { loadStateFromDb } = await import('@/lib/trading/db-store')
      const dbState = await loadStateFromDb(wallet)
      if (dbState && dbState.activity && dbState.activity.length > 0) {
        agent.hydrateState(dbState)
      }
    } catch {
      /* DB unavailable — fall back to in-memory state */
    }
  }

  await agent.maybeTick()
  return agent.toOverview()
}

export async function handleGetTradingOverview(authCtx: McpAuthContext): Promise<unknown> {
  const o = await loadOverview(authCtx)
  return {
    mode: o.mode,
    account: o.mode === 'live' ? 'live account' : authCtx.authenticated ? 'your paper account' : 'guest demo account',
    agent: {
      status: o.agent.status,
      strategy: o.agent.strategy,
      markets_scanned: o.agent.marketsScanned,
      signals_above_threshold: o.agent.confidenceHighSignals,
      last_scan_at: o.agent.lastScanAt,
    },
    account_state: {
      total_equity: o.account.totalEquity,
      main_wallet: o.account.mainWallet,
      trading_wallet: o.account.tradingWallet,
      budget: o.account.budget,
      max_loss: o.account.maxLoss,
      today_pnl: o.account.todayPnl,
      today_pnl_pct: o.account.todayPnlPct,
      all_time_pnl: o.account.allTimePnl,
    },
    open_positions: o.positions.length,
    disclaimer:
      o.mode === 'paper'
        ? 'Paper mode: simulated money on real market data. No real funds at risk.'
        : 'Live mode: real funds. The agent holds trading-only permissions and can never withdraw.',
  }
}

export async function handleGetPositions(authCtx: McpAuthContext): Promise<unknown> {
  const o = await loadOverview(authCtx)
  return {
    mode: o.mode,
    count: o.positions.length,
    positions: o.positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      leverage: p.leverage,
      size: p.size,
      entry_price: p.entry,
      mark_price: p.mark,
      unrealized_pnl: p.pnl,
      unrealized_pnl_pct: p.pnlPct,
      reason: p.reason,
    })),
  }
}

export async function handleGetActivity(
  args: { limit?: number },
  authCtx: McpAuthContext,
): Promise<unknown> {
  const o = await loadOverview(authCtx)
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50)
  return {
    mode: o.mode,
    items: o.activity.slice(0, limit).map((a) => ({
      time: a.time,
      type: a.type,
      text: a.text,
      pnl: a.pnl,
    })),
  }
}

export async function handleControlTradingAgent(
  args: { action: 'pause' | 'resume' | 'stop' },
  authCtx: McpAuthContext,
): Promise<unknown> {
  const address = requireAuth(authCtx)
  const { getAgentForWallet } = await import('@/lib/trading/agent')
  const agent = getAgentForWallet(address)

  switch (args.action) {
    case 'pause':
      agent.pause()
      return { ok: true, action: 'pause', status: agent.toOverview().agent.status, note: 'No new trades will open. Existing positions are still managed.' }
    case 'resume':
      agent.resume()
      return { ok: true, action: 'resume', status: agent.toOverview().agent.status, note: 'The agent is scanning markets again.' }
    case 'stop':
      agent.stop()
      return { ok: true, action: 'stop', status: agent.toOverview().agent.status, note: 'Emergency stop engaged. Revoke the agent wallet to fully cut off access.' }
    default:
      throw new Error(`Unknown action "${args.action}". Use pause, resume or stop.`)
  }
}

export async function handleGetTrackRecord(): Promise<unknown> {
  // Prefer the direct DB read (fast, no network), fall back to the public API
  // when the database isn't reachable from this machine (local/proxy setups).
  try {
    const { prisma } = await import('@/lib/prisma')
    const accounts = await prisma.tradingAccount.findMany({
      where: { status: 'live' },
      select: {
        wallet_address: true,
        agent_name: true,
        budget_usd: true,
        trades: { where: { mode: 'live', status: 'closed' }, select: { pnl: true } },
      },
    })

    // Same anonymization as the public /api/trading/track-record endpoint.
    const shortHash = (s: string) => {
      let h = 0x811c9dc5
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
      }
      return 'acct-' + h.toString(16).padStart(8, '0').slice(0, 8)
    }

    const entries = accounts.map((a) => {
      const realized = (a.trades ?? []).reduce((sum, t) => sum + (t.pnl ?? 0), 0)
      return {
        account: shortHash(a.wallet_address),
        name: a.agent_name ?? 'Agent',
        budget_usd: Math.round((a.budget_usd ?? 0) * 100) / 100,
        realized_pnl: Math.round(realized * 100) / 100,
        trades: (a.trades ?? []).length,
      }
    })

    return {
      live_accounts: entries.length,
      total_realized_pnl: Math.round(entries.reduce((s, e) => s + e.realized_pnl, 0) * 100) / 100,
      accounts: entries,
      disclaimer:
        'Real funds traded by the Protocol Bank agent on Hyperliquid. Past performance does not guarantee future results.',
    }
  } catch {
    // DB unreachable — use the public API (same data, served by the app).
    const base = process.env.PROTOCOL_BANK_API_URL || 'https://protocolbanks.com'
    const res = await fetch(`${base}/api/trading/track-record`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Track record unavailable (HTTP ${res.status})`)
    const d = (await res.json()) as {
      liveAccountCount?: number
      totalRealizedPnl?: number
      totalBudget?: number
      accounts?: Array<{ id: string; name: string; budgetUsd: number; realizedPnl: number; tradeCount: number }>
      disclaimer?: string
    }
    // Normalise to the same snake_case shape as the direct-DB path.
    return {
      live_accounts: d.liveAccountCount ?? 0,
      total_realized_pnl: d.totalRealizedPnl ?? 0,
      total_budget: d.totalBudget ?? 0,
      accounts: (d.accounts ?? []).map((a) => ({
        account: a.id,
        name: a.name,
        budget_usd: a.budgetUsd,
        realized_pnl: a.realizedPnl,
        trades: a.tradeCount,
      })),
      disclaimer: d.disclaimer,
    }
  }
}
