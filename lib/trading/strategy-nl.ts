/**
 * Turns a plain-language strategy request into a *proposal* on the same
 * bounded schema the rest of the platform uses. The model never returns a
 * config directly: its JSON is parsed here, then resolveStrategyProfile clamps
 * and validates it, and a human confirms before anything is applied.
 */
import { PRESETS, type StrategyPreset } from "./strategy-profile"

export type Completer = (system: string, user: string) => Promise<{ raw: string } | null>

export interface StrategyIntent {
  preset: StrategyPreset
  overrides: Record<string, number | string>
  note: string
}

export function buildStrategySystemPrompt(): string {
  const presetList = Object.keys(PRESETS).join(", ")
  return [
    "You translate a trader's plain-language request into a bounded strategy profile.",
    "Reply with a single JSON object and nothing else:",
    '{"preset":"<one of: ' + presetList + '>","overrides":{"<field>":<value>},"note":"<one short sentence>"}',
    "Tunable fields and hard ranges (the server will clamp anything outside them):",
    "entryThreshold 0.3-0.8, exitFadeThreshold 0.1-0.6, takeProfitPct 0.01-0.05, stopLossPct 0.01-0.05,",
    "dailyLossStopPct 0.02-0.1, dailyLossKillPct 0.04-0.15, positionPct 0.05-0.25, maxPositions 1-5 (integer),",
    "leverage 1-3 (integer), minVolumeUsd >= 1000000, minNotionalUsd 10-500, slippageRate 0.001-0.05.",
    'approvalMode must be "auto" or "manual".',
    "Omit overrides you do not need. Never invent fields. Never promise returns. If the request is unclear, choose the closest preset and say so in note.",
  ].join("\n")
}

/** Extract the model's JSON. Returns null on anything unusable. */
export function parseStrategyIntent(raw: string): StrategyIntent | null {
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
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>
  const preset = typeof obj.preset === "string" ? (obj.preset as StrategyPreset) : ("balanced" as StrategyPreset)
  if (!Object.prototype.hasOwnProperty.call(PRESETS, preset)) return null
  const rawOverrides = obj.overrides
  if (rawOverrides !== undefined && (rawOverrides === null || typeof rawOverrides !== "object" || Array.isArray(rawOverrides))) {
    return null
  }
  const overrides: Record<string, number | string> = {}
  for (const [k, v] of Object.entries((rawOverrides ?? {}) as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) overrides[k] = v
    else if (typeof v === "string") overrides[k] = v
  }
  return { preset, overrides, note: typeof obj.note === "string" ? obj.note.slice(0, 140) : "" }
}

export async function interpretStrategyRequest(
  request: string,
  complete: Completer,
): Promise<{ ok: true; intent: StrategyIntent } | { ok: false; reason: string }> {
  const out = await complete(buildStrategySystemPrompt(), JSON.stringify({ request, task: "encode_strategy" }))
  if (!out) return { ok: false, reason: "the strategy interpreter is unavailable — try a preset instead" }
  const intent = parseStrategyIntent(out.raw)
  if (!intent) return { ok: false, reason: "could not read the interpreter's answer — try a preset instead" }
  return { ok: true, intent }
}
