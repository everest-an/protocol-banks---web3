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
  action: z
    .enum(['pause', 'resume', 'stop', 'approve', 'reject', 'set_approval'])
    .describe(
      'The control action: pause/resume/stop the agent, approve/reject a pending trade (manual approval mode), or set_approval to switch entry mode.',
    ),
  mode: z
    .enum(['auto', 'manual'])
    .optional()
    .describe('Required for set_approval: "auto" places entries automatically, "manual" holds each entry for approval.'),
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
    'Control the AI trading agent. Actions: "pause" (stop opening new trades, keep managing positions), "resume" (start scanning again), "stop" (emergency stop — halt everything), "approve"/"reject" (resolve a pending trade in manual approval mode), "set_approval" (+ mode: auto|manual — choose whether entries need your approval). Requires authentication.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['pause', 'resume', 'stop', 'approve', 'reject', 'set_approval'],
        description: 'The control action to perform.',
      },
      mode: {
        type: 'string',
        enum: ['auto', 'manual'],
        description: 'Required for set_approval: entry mode.',
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
  const { resolveAgentForWallet } = await import('@/lib/trading/agent')
  const wallet = authCtx.authenticated && authCtx.address ? authCtx.address : null
  const agent = await resolveAgentForWallet(wallet)

  // Hydrate per-user paper state from the DB when available (same as the API
  // route). Mode-guarded so a stale paper ledger can't overwrite a live state.
  if (wallet) {
    try {
      const { loadStateFromDb } = await import('@/lib/trading/db-store')
      const dbState = await loadStateFromDb(wallet)
      const expectedMode = agent.isLive() ? 'live' : 'paper'
      if (dbState && dbState.mode === expectedMode && dbState.activity && dbState.activity.length > 0) {
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
    approval_mode: o.approvalMode ?? 'auto',
    pending_trade: o.pendingTrade ?? null,
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
  args: { action: 'pause' | 'resume' | 'stop' | 'approve' | 'reject' | 'set_approval'; mode?: 'auto' | 'manual' },
  authCtx: McpAuthContext,
): Promise<unknown> {
  const address = requireAuth(authCtx)
  const { resolveAgentForWallet } = await import('@/lib/trading/agent')
  const agent = await resolveAgentForWallet(address)

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
    case 'approve': {
      const result = await agent.approvePendingTrade()
      return { ok: result.ok, action: 'approve', note: result.note }
    }
    case 'reject': {
      const result = agent.rejectPendingTrade()
      return { ok: result.ok, action: 'reject', note: result.note }
    }
    case 'set_approval': {
      if (args.mode !== 'auto' && args.mode !== 'manual') {
        throw new Error('set_approval requires mode: "auto" | "manual"')
      }
      const result = agent.setApprovalMode(args.mode)
      return { ok: result.ok, action: 'set_approval', mode: args.mode, note: result.note }
    }
    default:
      throw new Error(`Unknown action "${args.action}".`)
  }
}

export async function handleGetTrackRecord(): Promise<unknown> {
  // Shared aggregation (lib/trading/track-record.ts) — same code path as the
  // public API and the /live-track-record page. Falls back to the public API
  // when the database isn't reachable from this machine.
  try {
    const { getLiveTrackRecord } = await import('@/lib/trading/track-record')
    const data = await getLiveTrackRecord()
    return {
      live_accounts: data.liveAccountCount,
      total_realized_pnl: data.totalRealizedPnl,
      total_budget: data.totalBudget,
      accounts: data.accounts.map((a) => ({
        account: a.id,
        name: a.name,
        budget_usd: a.budgetUsd,
        realized_pnl: a.realizedPnl,
        trades: a.tradeCount,
      })),
      disclaimer: data.disclaimer,
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
