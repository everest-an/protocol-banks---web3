// Sync docs/PRODUCT_GUIDE.md into app/product-guide/guide.json so the page
// bundles the content at build time instead of reading the filesystem at
// request time (which does not exist in a serverless runtime). Runs as a
// prebuild step; run manually after editing the guide.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'docs', 'PRODUCT_GUIDE.md')
const out = path.join(root, 'app', 'product-guide', 'guide.json')

// .vercelignore excludes docs/ and *.md from the build upload, so on Vercel
// this script runs without its source. The committed guide.json is the
// deployed source of truth; here we simply keep it (exit 0 so the build
// continues). Locally and in CI the file exists and the JSON is regenerated.
if (!fs.existsSync(src)) {
  console.log(`docs/PRODUCT_GUIDE.md not present here - keeping committed ${path.relative(root, out)}`)
  process.exit(0)
}

const md = fs.readFileSync(src, 'utf8')
fs.writeFileSync(out, JSON.stringify(md) + '\n', 'utf8')
console.log(`synced ${src} -> ${out} (${md.length} chars)`)
