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

const md = fs.readFileSync(src, 'utf8')
fs.writeFileSync(out, JSON.stringify(md) + '\n', 'utf8')
console.log(`synced ${src} -> ${out} (${md.length} chars)`)
