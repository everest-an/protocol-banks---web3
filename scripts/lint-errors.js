// Helper: find which files still have ERROR-level lint issues, grouped by rule.
const { ESLint } = require("eslint")
const path = require("path")

async function main() {
  const eslint = new ESLint({ cwd: path.resolve(__dirname, "..") })
  const results = await eslint.lintFiles(["."])
  const byRule = new Map()
  const byFile = new Map()
  for (const r of results) {
    for (const m of r.messages) {
      if (m.severity !== 2) continue
      const rule = m.ruleId || "unknown"
      byRule.set(rule, (byRule.get(rule) || 0) + 1)
      const rel = r.filePath.replace(/^.*Protocol Bank[\\/]/, "")
      if (!byFile.has(rel)) byFile.set(rel, new Set())
      byFile.get(rel).add(rule)
    }
  }
  console.log("=== errors by rule ===")
  for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${count}\t${rule}`)
  }
  console.log("\n=== files with errors ===")
  for (const [file, rules] of [...byFile.entries()].sort()) {
    console.log(`${file}\t${[...rules].join(",")}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
