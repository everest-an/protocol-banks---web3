/**
 * Confirm migrations 034-036 landed before trusting the app against this database.
 *
 * The app's Prisma client selects these columns on every subscription query, so
 * if any are missing the subscription endpoints return 500 rather than degrading.
 * Run this immediately after applying the migrations.
 *
 * Usage:
 *   DIRECT_DATABASE_URL=postgres://... node scripts/verify-migrations.mjs
 */

import { PrismaClient } from '@prisma/client'

const REQUIRED = {
  subscriptions: [
    ['onchain_subscription_id', '035'],
    ['manager_address', '035'],
    ['failed_attempts', '036'],
    ['last_failure_reason', '036'],
    ['last_failure_at', '036'],
  ],
  subscription_authorizations: [
    ['period_index', '034'],
    ['nonce', '030'],
    ['valid_after', '030'],
    ['valid_before', '030'],
  ],
}

if (!process.env.DIRECT_DATABASE_URL && !process.env.DATABASE_URL) {
  console.error(
    'Set DIRECT_DATABASE_URL (or DATABASE_URL) to the database you just migrated.\n' +
    '  e.g.  DIRECT_DATABASE_URL="postgres://..." node scripts/verify-migrations.mjs'
  )
  process.exit(2)
}

const prisma = new PrismaClient()

try {
  let missing = 0

  for (const [table, columns] of Object.entries(REQUIRED)) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      table
    )
    const present = new Set(rows.map((r) => r.column_name))

    if (present.size === 0) {
      console.log(`\n❌ table "${table}" does not exist`)
      missing += columns.length
      continue
    }

    console.log(`\n${table}`)
    for (const [column, migration] of columns) {
      const ok = present.has(column)
      if (!ok) missing++
      console.log(`  ${ok ? '✅' : '❌'} ${column.padEnd(26)} (migration ${migration})`)
    }
  }

  // The subscription read path is what actually breaks when a column is absent.
  console.log('\nLive query check')
  try {
    await prisma.subscription.findFirst({ select: { id: true, failed_attempts: true, onchain_subscription_id: true } })
    console.log('  ✅ subscription query succeeds')
  } catch (error) {
    missing++
    console.log(`  ❌ subscription query fails: ${error.message.split('\n')[0]}`)
  }

  if (missing > 0) {
    console.log(`\n❌ ${missing} item(s) missing — apply scripts/034, 035, 036 before deploying.`)
    process.exit(1)
  }

  console.log('\n✅ Migrations 034-036 are applied; the subscription path is safe to use.')
} finally {
  await prisma.$disconnect()
}
