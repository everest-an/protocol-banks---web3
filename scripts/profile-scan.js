/**
 * Scan ALL Chrome profiles for social-platform sessions.
 * For each profile: copy cookies, launch a headless persistent context,
 * and report which platforms have real session tokens.
 */
const { chromium } = require("@playwright/test")
const fs = require("fs")
const path = require("path")
const os = require("os")

const CHROME_ROOT = path.join(os.homedir(), "AppData", "Local", "Google", "Chrome", "User Data")
const TMP_ROOT = path.join(os.tmpdir(), "opencode", "profile-scan")

function listProfiles() {
  return fs
    .readdirSync(CHROME_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^(Default|Profile)/.test(d.name))
    .map((d) => d.name)
}

async function scanProfile(profileName) {
  const srcCookies = path.join(CHROME_ROOT, profileName, "Network", "Cookies")
  if (!fs.existsSync(srcCookies)) return null

  const profileDir = path.join(TMP_ROOT, profileName)
  fs.mkdirSync(path.join(profileDir, "Network"), { recursive: true })
  fs.copyFileSync(srcCookies, path.join(profileDir, "Network", "Cookies"))

  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    channel: "chrome",
    args: ["--no-first-run"],
  })

  const xCookies = await ctx.cookies("https://x.com")
  const twitterCookies = await ctx.cookies("https://twitter.com")
  const redditCookies = await ctx.cookies("https://www.reddit.com")
  const phCookies = await ctx.cookies("https://www.producthunt.com")

  const has = (list, key) => list.some((c) => c.name === key)
  const result = {
    profile: profileName,
    x: has([...xCookies, ...twitterCookies], "auth_token"),
    reddit: has(redditCookies, "token_v2") || has(redditCookies, "reddit_session"),
    producthunt: phCookies.some((c) => !["__cf_bm", "_ga", "_gid"].includes(c.name)),
  }
  await ctx.close()
  return result
}

async function main() {
  const profiles = listProfiles()
  console.log("profiles found:", profiles.join(", "))
  for (const p of profiles) {
    try {
      const r = await scanProfile(p)
      if (r) console.log(JSON.stringify(r))
    } catch (e) {
      console.log(JSON.stringify({ profile: p, error: e.message.slice(0, 100) }))
    }
  }
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
