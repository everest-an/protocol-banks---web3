/**
 * Apply SQL migration files to the database in DIRECT_DATABASE_URL.
 *
 * The project keeps migrations as plain SQL under scripts/ and applies them by
 * hand; this just does that reliably from Node, since psql is not always
 * installed. Each file runs inside its own transaction, so a failure leaves that
 * file's changes rolled back rather than half-applied.
 *
 * Destructive files are refused unless --allow-destructive is passed, so a
 * DROP cannot be run by reflex alongside a batch of additive ones.
 *
 * Usage:
 *   node scripts/apply-migrations.mjs scripts/034_*.sql scripts/035_*.sql
 */

import { readFileSync } from 'node:fs'
import pg from 'pg'

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const allowDestructive = process.argv.includes('--allow-destructive')

if (files.length === 0) {
  console.error('Usage: node scripts/apply-migrations.mjs <file.sql> [...]')
  process.exit(2)
}

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Set DIRECT_DATABASE_URL (or DATABASE_URL).')
  process.exit(2)
}

const DESTRUCTIVE = /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM)\b/i

for (const file of files) {
  const sql = readFileSync(file, 'utf8')
  if (DESTRUCTIVE.test(sql) && !allowDestructive) {
    console.error(
      `\n❌ ${file} contains a destructive statement.\n` +
      '   Refusing to run it as part of a routine migration batch.\n' +
      '   Re-run that file on its own with --allow-destructive once you have\n' +
      '   confirmed the data it removes is expendable.'
    )
    process.exit(1)
  }
}

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  for (const file of files) {
    const sql = readFileSync(file, 'utf8')
    process.stdout.write(`\n▶ ${file}\n`)
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('COMMIT')
      console.log('  ✅ applied')
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`  ❌ ${error.message.split('\n')[0]}`)
      console.error('  rolled back; no partial changes from this file')
      process.exitCode = 1
      break
    }
  }
} finally {
  await client.end()
}
