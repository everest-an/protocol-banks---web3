/**
 * Product analytics for the acquisition funnel: landing → cockpit → bound
 * wallet → live approval → first trade.
 *
 * Two rules make this safe and useful:
 *  - the event name is a closed whitelist, so a client cannot invent series;
 *  - the wallet on a server-side event always comes from the authenticated
 *    session, never from the request body.
 */
export const EVENT_NAMES = [
  "landing_view",
  "cockpit_view",
  "wallet_bound",
  "live_approved",
  "trade_opened",
  "strategy_applied",
  "nl_command",
] as const

export type EventName = (typeof EVENT_NAMES)[number]

export function isEventName(value: string): value is EventName {
  return (EVENT_NAMES as readonly string[]).includes(value)
}

export interface EventInput {
  name: EventName
  wallet?: string | null
  anonId?: string | null
  path?: string | null
  props?: Record<string, unknown>
}

/** Fire-and-forget: analytics must never break a page or a trade. */
export async function recordEvent(input: EventInput): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma")
    await prisma.usageEvent.create({
      data: {
        name: input.name,
        wallet: input.wallet ? input.wallet.toLowerCase() : null,
        anon_id: input.anonId ? String(input.anonId).slice(0, 64) : null,
        path: input.path ? String(input.path).slice(0, 200) : null,
        props: (input.props ?? {}) as object,
      },
    })
  } catch (e) {
    console.warn("[events] skipped:", e)
  }
}

const ANON_KEY = "pb_anon_id"

export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(ANON_KEY, id)
    return id
  } catch {
    return "anonymous"
  }
}

/** Browser-side event. sendBeacon survives the navigation it usually precedes. */
export function track(name: EventName, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return
  try {
    const body = JSON.stringify({ name, anonId: getAnonId(), props, path: window.location.pathname })
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))
      return
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    })
  } catch {
    /* never break the page for analytics */
  }
}
