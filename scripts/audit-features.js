// Deep feature audit: for each (products) page, summarize what it renders
// (demo data? hooks? API?) to find merge candidates and broken features.
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const prodRoot = path.join(ROOT, "app", "(products)")

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const prodDirs = fs.readdirSync(prodRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)

for (const d of prodDirs) {
  const files = walk(path.join(prodRoot, d))
  let text = ""
  for (const f of files) text += fs.readFileSync(f, "utf8") + "\n"

  const indicators = []
  if (/useDemo|isDemoMode|demo-context|DemoData|DEMO/i.test(text)) indicators.push("demo-mode")
  if (/generate.*Demo|mock|MOCK|placeholder data|fake/i.test(text)) indicators.push("mock-data")
  if (/useSWR|useEffect.*fetch|authHeaders|createAuthenticatedFetch|use[A-Z][a-zA-Z]+\(/i.test(text)) indicators.push("hooks/api")
  if (/coming soon|not available|under construction|TODO|FIXME/i.test(text)) indicators.push("stub/todo")
  if (/iframe|embed code|snippet|npm install|SDK/i.test(text)) indicators.push("docs/sdk")

  const apiCalls = [...new Set([...text.matchAll(/["'`](\/api\/[a-zA-Z0-9\-_/]+)["'`]/g)].map((m) => m[1]))].slice(0, 5)

  console.log(
    `${d.padEnd(20)} | ${(indicators.join(", ") || "real").padEnd(28)} | ${apiCalls.join(" ") || "no direct API"}`,
  )
}
