// MCP stdio smoke test: spawn the server, list tools, call get_trading_overview.
// Usage: node --experimental-strip-types scripts/test-mcp.mjs   (or plain node)
const { spawn } = require("node:child_process")

const child = spawn("npx", ["tsx", "lib/mcp/stdio-server.ts"], {
  cwd: process.cwd(),
  stdio: ["pipe", "pipe", "pipe"],
  shell: true,
})

let buf = ""
const send = (msg) => child.stdin.write(JSON.stringify(msg) + "\n")

const timer = setTimeout(() => {
  console.error("TIMEOUT — no response in 60s")
  child.kill()
  process.exit(1)
}, 60000)

child.stdout.on("data", (d) => {
  buf += d.toString()
  const lines = buf.split("\n")
  buf = lines.pop() ?? ""
  for (const line of lines) {
    if (!line.trim()) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (msg.id === 1) {
      console.log("✓ initialize ->", msg.result?.serverInfo?.name, "v" + msg.result?.serverInfo?.version)
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
    } else if (msg.id === 2) {
      const names = (msg.result?.tools ?? []).map((t) => t.name)
      console.log("✓ tools/list ->", names.length, "tools")
      console.log("  trading tools:", names.filter((n) => /trading|position|activity|track|control/.test(n)).join(", "))
      send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_trading_overview", arguments: {} } })
    } else if (msg.id === 3) {
      const text = msg.result?.content?.[0]?.text ?? ""
      const parsed = (() => { try { return JSON.parse(text) } catch { return null } })()
      if (parsed) {
        console.log("✓ get_trading_overview ->")
        console.log("  mode:", parsed.mode, "| account:", parsed.account)
        console.log("  agent:", parsed.agent?.status, "| equity:", parsed.account_state?.total_equity)
        console.log("  positions:", parsed.open_positions)
      } else {
        console.log("✓ get_trading_overview -> (raw)", text.slice(0, 200))
      }
      send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_activity", arguments: { limit: 3 } } })
    } else if (msg.id === 4) {
      const text = msg.result?.content?.[0]?.text ?? ""
      const parsed = (() => { try { return JSON.parse(text) } catch { return null } })()
      console.log("✓ get_activity ->", parsed?.items?.length ?? "?", "items")
      if (parsed?.items?.[0]) console.log("  latest:", parsed.items[0].text?.slice(0, 80))
      send({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_track_record", arguments: {} } })
    } else if (msg.id === 5) {
      const text = msg.result?.content?.[0]?.text ?? ""
      const parsed = (() => { try { return JSON.parse(text) } catch { return null } })()
      console.log("✓ get_track_record ->", parsed?.live_accounts ?? "?", "live accounts")
      // control without auth must fail with a clear error
      send({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "control_trading_agent", arguments: { action: "pause" } } })
    } else if (msg.id === 6) {
      const isErr = msg.result?.isError === true
      const text = msg.result?.content?.[0]?.text ?? ""
      console.log(`${isErr ? "✓" : "✗"} control_trading_agent without auth ->`, isErr ? "correctly rejected" : "UNEXPECTED: " + text.slice(0, 120))
      clearTimeout(timer)
      child.kill()
      console.log("\nMCP smoke test complete.")
      process.exit(0)
    }
  }
})

child.stderr.on("data", (d) => {
  const s = d.toString()
  if (s.includes("Fatal") || s.includes("Error")) console.error("[server stderr]", s.slice(0, 300))
})

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke-test", version: "1.0" } },
})
