// One-off audit helper: find orphan API routes and product pages.
// Usage: node scripts/audit-orphans.ts
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")

function walk(dir, out = [], skip = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (skip.some((s) => p.includes(s))) continue
    if (e.isDirectory()) walk(p, out, skip)
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const apiDirs = fs
  .readdirSync(path.join(ROOT, "app", "api"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const prodDirs = fs
  .readdirSync(path.join(ROOT, "app", "(products)"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)

const SKIP = [".git", "node_modules", ".next", ".data", "AlphaGPT", "services"]
const files = walk(ROOT, [], SKIP)

function countRefs(pattern, excludeDirPart) {
  let n = 0
  const examples = []
  for (const f of files) {
    if (f.includes(excludeDirPart)) continue
    const t = fs.readFileSync(f, "utf8")
    const m = t.match(new RegExp(pattern, "g")) || []
    if (m.length) {
      n += m.length
      if (examples.length < 3) examples.push(path.relative(ROOT, f))
    }
  }
  return { n, examples }
}

console.log("=== API route groups with ZERO references outside their own dir ===")
const apiOrphans = []
for (const d of apiDirs) {
  const r = countRefs("/api/" + d, path.join("app", "api", d))
  if (r.n === 0) {
    apiOrphans.push(d)
    console.log("  ORPHAN  app/api/" + d)
  }
}

console.log("\n=== (products) pages with ZERO href/push references ===")
const pageOrphans = []
for (const d of prodDirs) {
  const r = countRefs("(/|\"|')" + d + "(\"|'|/|$)", path.join("app", "(products)", d))
  if (r.n === 0) {
    pageOrphans.push(d)
    console.log("  NO-REF  app/(products)/" + d)
  }
}

console.log("\n=== summary ===")
console.log("api orphans:", apiOrphans.length, "| page orphans:", pageOrphans.length)
