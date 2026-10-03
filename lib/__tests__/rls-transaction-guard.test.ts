/**
 * Guard: raw interactive/batch transactions in API routes bypass the RLS scope.
 *
 * Prisma Client extensions cannot intercept `prisma.$transaction`, so a raw
 * call would execute its callback unscoped (and, under RLS_MODE=enforce, nest
 * transactions). User-context code must use `scopedTransaction` from
 * `@/lib/prisma`; system paths must carry an explicit `rls:system` marker.
 *
 * This test fails when a new raw transaction appears in `app/` without either.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const APP_DIR = join(process.cwd(), "app")
const RAW_TX = /\bprisma\.\$transaction\s*\(/
const SYSTEM_MARKER = "rls:system"

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...filesUnder(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe("rls transaction guard", () => {
  test("no unscoped prisma.$transaction in app routes", () => {
    const offenders: string[] = []
    for (const file of filesUnder(APP_DIR)) {
      const content = readFileSync(file, "utf8")
      if (RAW_TX.test(content) && !content.includes(SYSTEM_MARKER)) {
        offenders.push(file.replace(process.cwd(), ""))
      }
    }
    expect(offenders).toEqual([])
  })
})
