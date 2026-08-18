// One-off audit helper part 2: for every (products) page, list the /api/* endpoints
// it calls and flag missing ones (page wired to a non-existent API = unusable feature).
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const prodRoot = path.join(ROOT, "app", "(products)")
const apiRoot = path.join(ROOT, "app", "api")

const apiExists = (routePath) => {
  // strip /api/ prefix and query/params
  const rel = routePath.replace(/^\/api\//, "").split("/")[0]
  if (!rel) return false
  const dir = path.join(apiRoot, rel)
  const hasDir = fs.existsSync(dir) && fs.statSync(dir).isDirectory()
  const hasFile = fs.existsSync(path.join(apiRoot, rel, "route.ts"))
  return hasDir && hasFile
}

const prodDirs = fs
  .readdirSync(prodRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

for (const d of prodDirs) {
  const files = walk(path.join(prodRoot, d))
  const calls = new Set()
  for (const f of files) {
    const t = fs.readFileSync(f, "utf8")
    for (const m of t.matchAll(/["'`](\/api\/[a-zA-Z0-9\-_]+)/g)) calls.add(m[1])
    for (const m of t.matchAll(/["'`]([a-zA-Z0-9\-_\/]*\/api\/[a-zA-Z0-9\-_]+)/g)) calls.add(m[1].replace(/^.*?(\/api\/)/, "/api/"))
  }
  if (calls.size === 0) {
    console.log(`PAGE ${String(d).padEnd(20)} -> NO API CALLS (demo-only page?)`)
    continue
  }
  const missing = [...calls].filter((c) => !apiExists(c))
  const status = missing.length ? `MISSING: ${missing.join(", ")}` : "all APIs exist"
  console.log(`PAGE ${String(d).padEnd(20)} -> ${status}`)
}
