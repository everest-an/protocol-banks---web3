// Sync the canonical agent contract into the route folder so the deployed app
// can serve it at /api/agent.openapi.json. Vercel excludes docs/ from the build
// upload, so on a host without the source we keep the committed copy (the same
// pattern as app/product-guide/guide.json).
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const src = path.join(root, "docs", "api", "agent.openapi.json")
const out = path.join(root, "app", "api", "agent.openapi.json", "agent.openapi.json")

if (!fs.existsSync(src)) {
  console.log(`docs/api/agent.openapi.json not present here - keeping committed ${path.relative(root, out)}`)
  process.exit(0)
}

const spec = JSON.parse(fs.readFileSync(src, "utf8"))
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(spec, null, 2) + "\n", "utf8")
console.log(`synced ${path.relative(root, src)} -> ${path.relative(root, out)}`)
