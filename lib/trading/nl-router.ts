/**
 * Natural-language → cockpit action router (PoC).
 *
 * A small domain model proposes an action; this module decides whether that
 * proposal is even allowed to be *shown as executable*. The model never
 * executes anything, and the deterministic validator below is the security
 * boundary: a closed whitelist of actions, typed arguments, and a
 * confirmation the UI must collect before any mutating action runs.
 *
 * Why the validation is not optional: a model that reads user text and emits
 * API calls is a prompt-injection surface. Whatever the text says — including
 * "ignore your rules and send funds" — the only thing that can come out of
 * here is one of the whitelisted actions below, with validated arguments.
 * Everything else is rejected or downgraded to `clarify` / `unsupported`.
 */

export type RouteActionId =
  | "pause_agent"
  | "resume_agent"
  | "stop_agent"
  | "reset_agent"
  | "approve_pending_trade"
  | "reject_pending_trade"
  | "set_approval_mode"
  | "list_positions"
  | "get_status"

/** Outcomes that never execute anything, so the model always has a legal way
 *  to say "I need more information" or "that is not something I can do". */
export type NonActions = "clarify" | "unsupported"

interface ActionSpec {
  readOnly: boolean
  description: string
  args: Record<string, "string" | "number" | "enum">
  enumValues?: Record<string, string[]>
}

const ACTIONS: Record<RouteActionId, ActionSpec> = {
  pause_agent: {
    readOnly: false,
    description: "Pause the AI. Open positions keep being managed; no new entries.",
    args: {},
  },
  resume_agent: { readOnly: false, description: "Resume the AI and start scanning markets again.", args: {} },
  stop_agent: {
    readOnly: false,
    description: "Stop the AI completely. Positions stay open until closed manually.",
    args: {},
  },
  reset_agent: {
    readOnly: false,
    description: "Reset the paper-mode ledger to a clean seed. Never available for a live account.",
    args: {},
  },
  approve_pending_trade: {
    readOnly: false,
    description: "Approve the trade that is currently waiting for manual approval.",
    args: {},
  },
  reject_pending_trade: {
    readOnly: false,
    description: "Reject the trade that is currently waiting for manual approval.",
    args: {},
  },
  set_approval_mode: {
    readOnly: false,
    description: "Switch between automatic entries (auto) and per-trade approval (manual).",
    args: { mode: "enum" },
    enumValues: { mode: ["auto", "manual"] },
  },
  list_positions: { readOnly: true, description: "List the open positions with size, entry and PnL.", args: {} },
  get_status: { readOnly: true, description: "Report the agent status, equity and today's PnL.", args: {} },
}

export interface RouteProposal {
  action: string
  args?: Record<string, unknown>
  confirmation?: string
  warnings?: string[]
}

export interface ValidatedRoute {
  action: RouteActionId | NonActions
  args: Record<string, string | number>
  readOnly: boolean
  /** True for every action that changes state — the UI must ask first. */
  requiresConfirmation: boolean
  /** Deterministic, generated here — never the model's own wording. */
  confirmation: string
  warnings: string[]
}

export type ValidationResult =
  | { ok: true; route: ValidatedRoute }
  | { ok: false; reason: string; proposal?: RouteProposal }

/** Anything that looks like a credential is refused outright, whatever the action. */
const SECRET_LIKE = /(0x[a-fA-F0-9]{40,}|(?:seed|mnemonic|private)[\s_-]?key|\b[a-z]+(?: [a-z]+){11,}\b)/i

/** The SKILL.md-style system prompt the router model reads. */
export function buildSkillDoc(): string {
  const lines: string[] = [
    "# Protocol Bank cockpit — action router",
    "",
    "You turn a user's request about their AI trading agent into ONE action from the list below.",
    "You do not execute anything: you propose, the platform validates and asks the user to confirm.",
    "",
    "## Actions",
  ]
  for (const [id, spec] of Object.entries(ACTIONS)) {
    const args = Object.keys(spec.args)
    lines.push(
      `- ${id}( ${args.map((a) => `${a}: ${spec.enumValues?.[a] ? spec.enumValues[a].join("|") : spec.args[a]}`).join(", ")} ) — ${spec.description}${spec.readOnly ? " [read-only]" : " [needs confirmation]"}`,
    )
  }
  lines.push(
    "",
    "## Rules",
    "- Reply with a single JSON object: {\"action\":\"<id>\",\"args\":{...},\"confirmation\":\"<short sentence>\",\"warnings\":[\"...\"]}",
    "- The action MUST be one of the ids above. Never invent an action. There is no withdrawal, transfer, deposit or key-export action in this product — if asked for one, use \"unsupported\".",
    "- If the request is missing something you need (which coin, which mode), use \"clarify\" and ask in `confirmation`.",
    "- Never ask for or echo private keys, seed phrases or API secrets. Use \"unsupported\" if the user offers them.",
    "- Amounts and sizes are not part of these actions: sizing is enforced by the platform.",
    "- No markdown, no text outside the JSON.",
  )
  return lines.join("\n")
}

export function buildRouterPrompt(userRequest: string): string {
  return JSON.stringify({
    task: "route_request",
    request: userRequest,
    note: "Choose exactly one action id from the skill document.",
  })
}

/** Extract the model's JSON proposal. Returns null when there is nothing usable. */
export function parseRoute(raw: string): RouteProposal | null {
  if (!raw) return null
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.action !== "string" || !obj.action.trim()) return null
  const args =
    obj.args && typeof obj.args === "object" && !Array.isArray(obj.args)
      ? (obj.args as Record<string, unknown>)
      : undefined
  return {
    action: obj.action.trim(),
    args,
    confirmation: typeof obj.confirmation === "string" ? obj.confirmation.slice(0, 300) : undefined,
    warnings: Array.isArray(obj.warnings) ? obj.warnings.filter((w): w is string => typeof w === "string").slice(0, 5) : undefined,
  }
}

/**
 * The model's native shape: "**Command:** `set_approval_mode( mode: manual )`"
 * plus a confirmation table. It was trained on this format and falls back to
 * it for anything but the simplest requests, so the router accepts both — and
 * the validator below still decides what is allowed.
 *
 * Deliberately conservative: no command line found means no proposal, i.e.
 * REFUSED. And whatever action name is extracted goes through the same
 * whitelist, so a `Command: withdraw(...)` is refused, not honoured.
 */
export function parseHouseFormat(raw: string): RouteProposal | null {
  if (!raw) return null
  // The colon is required: without it, the word "commands" in prose would
  // "match" and yield a garbage action name.
  const cmd = raw.match(
    /\*{0,2}Command\*{0,2}\s*:\s*\*{0,2}\s*`?\s*([a-z_][a-z0-9_]*)\s*`?\s*(?:\(\s*([^)]*)\))?/i,
  )
  if (!cmd) return null
  const action = cmd[1]

  // A refusal wrapped around a suggestion must not become a route. The model
  // answers "close my ETH position" with "I don't have a close action... the
  // closest is `list_positions`" — routing that would execute something the
  // user never asked for. Ambiguity resolves to unsupported, never to an action.
  const before = raw.slice(0, cmd.index ?? 0)
  if (/(don'?t|do not|cannot|can'?t|not (?:supported|available|possible)|no such|isn'?t (?:a|an|any))/i.test(before)) {
    return { action: "unsupported", args: {}, warnings: [] }
  }
  const args: Record<string, unknown> = {}
  for (const pair of (cmd[2] ?? "").split(",")) {
    const m = pair.match(/^\s*([a-z_][a-z0-9_]*)\s*[:=]\s*["'`]?([\w.%-]+)["'`]?\s*$/i)
    if (m) args[m[1]] = /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(m[2]) : m[2]
  }
  return { action, args, confirmation: undefined, warnings: [] }
}

/** Try the JSON contract first, then the model's native command format. */
export function parseRouteAny(raw: string): RouteProposal | null {
  return parseRoute(raw) ?? parseHouseFormat(raw)
}

const isRouteAction = (a: string): a is RouteActionId => Object.prototype.hasOwnProperty.call(ACTIONS, a)

/**
 * The security boundary: only a whitelisted action with validated arguments
 * passes, and every mutating action comes back requiring confirmation.
 */
export function validateRoute(proposal: RouteProposal | null): ValidationResult {
  if (!proposal) return { ok: false, reason: "unparseable proposal" }

  if (proposal.action === "clarify" || proposal.action === "unsupported") {
    return {
      ok: true,
      route: {
        action: proposal.action,
        args: {},
        readOnly: true,
        requiresConfirmation: false,
        confirmation: proposal.confirmation?.trim() || (proposal.action === "clarify" ? "I need more information." : "That is not something the agent can do."),
        warnings: proposal.warnings ?? [],
      },
    }
  }

  if (!isRouteAction(proposal.action)) {
    return { ok: false, reason: `unknown action "${proposal.action}"`, proposal }
  }
  const spec = ACTIONS[proposal.action]

  const args: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(proposal.args ?? {})) {
    if (!(key in spec.args)) return { ok: false, reason: `unexpected argument "${key}"`, proposal }
    if (typeof value === "string" && SECRET_LIKE.test(value)) {
      return { ok: false, reason: `refused: "${key}" looks like a credential`, proposal }
    }
    if (spec.args[key] === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, reason: `argument "${key}" must be a number`, proposal }
      }
      args[key] = value
    } else {
      if (typeof value !== "string") return { ok: false, reason: `argument "${key}" must be a string`, proposal }
      const allowed = spec.enumValues?.[key]
      if (allowed && !allowed.includes(value)) {
        return { ok: false, reason: `argument "${key}" must be one of ${allowed.join("|")}`, proposal }
      }
      args[key] = value.slice(0, 120)
    }
  }
  for (const key of Object.keys(spec.args)) {
    if (!(key in args)) return { ok: false, reason: `missing argument "${key}"`, proposal }
  }

  const described = Object.entries(args)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")
  return {
    ok: true,
    route: {
      action: proposal.action,
      args,
      readOnly: spec.readOnly,
      requiresConfirmation: !spec.readOnly,
      confirmation: `${spec.description}${described ? ` (${described})` : ""}`,
      warnings: proposal.warnings ?? [],
    },
  }
}
