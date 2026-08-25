/** Dump which platforms have real session cookies. */
const { chromium } = require("@playwright/test")

const USER_DATA_DIR = "C:/Users/ASUS/AppData/Local/Temp/opencode/chrome-profile/User Data"

const TARGETS = [
  { name: "X (twitter)", domain: ".x.com", key: "auth_token" },
  { name: "X (twitter.com)", domain: ".twitter.com", key: "auth_token" },
  { name: "Reddit", domain: ".reddit.com", key: "reddit_session" },
  { name: "Reddit (token_v2)", domain: ".reddit.com", key: "token_v2" },
  { name: "ProductHunt", domain: ".producthunt.com", key: null },
]

async function main() {
  const ctx = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: true,
    channel: "chrome",
    args: ["--no-first-run"],
  })
  const cookies = await ctx.cookies()

  const byDomain = {}
  for (const c of cookies) {
    const d = c.domain.replace(/^\./, "")
    if (!byDomain[d]) byDomain[d] = []
    byDomain[d].push(c.name)
  }

  for (const t of TARGETS) {
    const d = t.domain.replace(/^\./, "")
    const names = byDomain[d] || []
    if (t.key) {
      console.log(`${t.name}: ${names.includes(t.key) ? "SESSION OK" : "no session"} (cookies: ${names.length})`)
    } else {
      console.log(`${t.name}: ${names.length} cookies: ${names.slice(0, 8).join(", ")}`)
    }
  }

  await ctx.close()
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
