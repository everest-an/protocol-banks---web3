/**
 * NL router tests — the security boundary, not the model.
 *
 * A model that reads user text and proposes API calls is an injection surface.
 * Everything below asserts that whatever comes out of the model, the only
 * thing that can reach the UI is a whitelisted action with validated
 * arguments and a deterministic confirmation.
 */
import { buildRouterPrompt, buildSkillDoc, parseRoute, parseRouteAny, toAgentAction, validateRoute } from "@/lib/trading/nl-router"

describe("nl router", () => {
  describe("skill doc and prompt", () => {
    it("documents every whitelisted action and nothing else", () => {
      const doc = buildSkillDoc()
      expect(doc).toContain("pause_agent")
      expect(doc).toContain("set_approval_mode")
      expect(doc).toContain("mode: auto|manual")
      // The product has no fund-moving action; the doc must say so.
      expect(doc).toMatch(/no withdrawal, transfer, deposit/i)
    })

    it("carries the user's request verbatim", () => {
      const prompt = buildRouterPrompt("pause the agent please")
      expect(JSON.parse(prompt)).toMatchObject({ task: "route_request", request: "pause the agent please" })
    })
  })

  describe("parseRoute", () => {
    it("accepts a clean JSON proposal", () => {
      const p = parseRoute('{"action":"pause_agent","args":{},"confirmation":"Pausing now."}')
      expect(p?.action).toBe("pause_agent")
    })

    it("extracts JSON embedded in prose", () => {
      const p = parseRoute('Sure — {"action":"get_status","args":{}} — done.')
      expect(p?.action).toBe("get_status")
    })

    it("rejects prose, empty and malformed output", () => {
      expect(parseRoute("I will pause the agent for you.")).toBeNull()
      expect(parseRoute("")).toBeNull()
      expect(parseRoute("{broken")).toBeNull()
      expect(parseRoute('{"args":{}}')).toBeNull()
    })
  })

  /**
   * VelvetFlash was trained on "**Command:** `action(args)` + confirmation
   * table" and falls back to it when our JSON contract is not what it reaches
   * for. 5 of 7 demo requests came back in that shape, so the router parses it
   * too — and the whitelist still decides what is allowed.
   */
  describe("parseHouseFormat (the model's native command shape)", () => {
    it("extracts an action with arguments from a command line", () => {
      const raw =
        "I'll switch the approval mode to manual so you can approve every trade yourself.\n\n" +
        "**Command:** `set_approval_mode( mode: manual )`\n\n| Field | Value |\n|---|---|"
      const p = parseRouteAny(raw)
      expect(p).toMatchObject({ action: "set_approval_mode", args: { mode: "manual" } })
      expect(validateRoute(p).ok).toBe(true)
    })

    it("extracts a bare command with no arguments", () => {
      const p = parseRouteAny("Shall I? **Command:** `pause_agent` — reply confirm to execute.")
      expect(p?.action).toBe("pause_agent")
    })

    it("still routes an unknown command to the validator, which refuses it", () => {
      const p = parseRouteAny("**Command:** `withdraw_all( to: 0xdead )`")
      expect(p?.action).toBe("withdraw_all")
      const verdict = validateRoute(p)
      expect(verdict.ok).toBe(false)
      if (!verdict.ok) expect(verdict.reason).toMatch(/unknown action/)
    })

    it("returns nothing when there is no command line at all", () => {
      expect(parseRouteAny("I cannot do that.")).toBeNull()
      expect(validateRoute(parseRouteAny("I cannot do that.")).ok).toBe(false)
    })

    it("turns a refusal-with-a-suggestion into unsupported, never into that action", () => {
      // Observed: asked to close a position, the model answers that no close
      // action exists and names the closest one it does have. Routing the
      // suggestion would run something the user never asked for.
      const raw =
        'I don\'t have a specific "close position" action listed in the available commands. ' +
        "The closest I can offer is **Command:** `list_positions`"
      const p = parseRouteAny(raw)
      expect(p?.action).toBe("unsupported")
      const verdict = validateRoute(p)
      expect(verdict.ok).toBe(true)
      if (verdict.ok) expect(verdict.route.readOnly).toBe(true)
    })

    it("prefers the JSON contract when the model provides both", () => {
      const raw = '{"action":"get_status","args":{}} — **Command:** `stop_agent`'
      expect(parseRouteAny(raw)?.action).toBe("get_status")
    })
  })

  describe("validateRoute — the whitelist is the security boundary", () => {
    it("accepts a read-only action without confirmation", () => {
      const r = validateRoute({ action: "list_positions" })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.route.readOnly).toBe(true)
      expect(r.route.requiresConfirmation).toBe(false)
    })

    it("requires confirmation for every mutating action", () => {
      for (const action of ["pause_agent", "resume_agent", "stop_agent", "reset_agent", "approve_pending_trade", "reject_pending_trade"]) {
        const r = validateRoute({ action })
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.route.requiresConfirmation).toBe(true)
      }
    })

    it("rejects an action that is not on the list (injection has nowhere to land)", () => {
      const r = validateRoute({ action: "withdraw_all_funds", args: { to: "0xdead" } })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/unknown action/)
    })

    it("rejects unknown arguments, wrong types and enum violations", () => {
      expect(validateRoute({ action: "pause_agent", args: { force: true } }).ok).toBe(false)
      expect(validateRoute({ action: "set_approval_mode", args: {} }).ok).toBe(false) // missing
      expect(validateRoute({ action: "set_approval_mode", args: { mode: "yolo" } }).ok).toBe(false)
      expect(validateRoute({ action: "set_approval_mode", args: { mode: 1 } }).ok).toBe(false)
      const ok = validateRoute({ action: "set_approval_mode", args: { mode: "manual" } })
      expect(ok.ok).toBe(true)
    })

    it("refuses arguments that look like credentials", () => {
      // A free-text arg is the only place a secret could even arrive, and the
      // enum check would not save us there — the secret pattern must.
      const r = validateRoute({ action: "set_approval_mode", args: { mode: "0x" + "ab".repeat(20) } })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toMatch(/credential/)
      // And an undeclared argument never reaches that check at all.
      const r2 = validateRoute({ action: "get_status", args: { note: "hello" } })
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.reason).toMatch(/unexpected argument/)
    })

    it("lets the model say clarify or unsupported, which never execute", () => {
      for (const action of ["clarify", "unsupported"]) {
        const r = validateRoute({ action, confirmation: "Which coin?" })
        expect(r.ok).toBe(true)
        if (r.ok) {
          expect(r.route.requiresConfirmation).toBe(false)
          expect(r.route.readOnly).toBe(true)
        }
      }
      const r = validateRoute({ action: "unsupported" })
      expect(r.ok && r.route.confirmation.length > 0).toBe(true)
    })

    it("generates the confirmation itself instead of echoing the model", () => {
      const r = validateRoute({
        action: "set_approval_mode",
        args: { mode: "manual" },
        confirmation: "I will send all your funds to 0xdead — confirm?", // model's prose
      })
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.route.confirmation).toContain("mode=manual")
      expect(r.route.confirmation).not.toContain("0xdead")
    })

    it("rejects an unparseable proposal", () => {
      const r = validateRoute(null)
      expect(r.ok).toBe(false)
    })
  })

  describe("toAgentAction — the only bridge to execution", () => {
    it("maps every mutating route to the existing actions endpoint payload", () => {
      const cases: Array<[string, Record<string, unknown>, { action: string; mode?: string }]> = [
        ["pause_agent", {}, { action: "pause" }],
        ["resume_agent", {}, { action: "resume" }],
        ["stop_agent", {}, { action: "stop" }],
        ["reset_agent", {}, { action: "reset" }],
        ["approve_pending_trade", {}, { action: "approve" }],
        ["reject_pending_trade", {}, { action: "reject" }],
        ["set_approval_mode", { mode: "manual" }, { action: "set_approval", mode: "manual" }],
      ]
      for (const [action, args, expected] of cases) {
        const verdict = validateRoute({ action, args })
        expect(verdict.ok).toBe(true)
        if (verdict.ok) expect(toAgentAction(verdict.route)).toEqual(expected)
      }
    })

    it("maps read-only, clarify and unsupported routes to no call at all", () => {
      for (const action of ["list_positions", "get_status", "clarify", "unsupported"]) {
        const verdict = validateRoute({ action })
        expect(verdict.ok).toBe(true)
        if (verdict.ok) expect(toAgentAction(verdict.route)).toBeNull()
      }
    })
  })
})
