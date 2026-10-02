/**
 * Seed the subscription plan catalogue.
 *
 * The billing feature expects a `subscription_plans` row named Free; without it
 * `ensureSubscription()` throws and `GET /api/billing/subscription` answers 500,
 * while `GET /api/billing/plans` returns an empty catalogue. The definitions
 * below are the ones authored in scripts/027_create_saas_billing.sql — that
 * script was simply never applied.
 *
 * The script discovers the table's actual columns first: the SQL file creates a
 * wider table (display_name/description/price_yearly/sort_order, some NOT NULL)
 * than the Prisma model, so a Prisma-shaped insert would fail on one shape and a
 * SQL-shaped insert on the other. Idempotent (upsert on name), safe to re-run.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/seed-billing-plans.ts
 *   CONFIRM_SEED=1 ...   # required to write
 */

const PLANS = [
  {
    name: "free",
    displayName: "Free",
    description: "Basic features for individuals",
    priceMonthly: 0,
    priceYearly: 0,
    features: ["5 recipients per batch", "Manual payments only", "Basic export (CSV)", "Email support"],
    limits: {
      max_recipients_per_batch: 5,
      max_scheduled_payments: 0,
      max_team_members: 1,
      max_split_templates: 3,
      transaction_fee_bps: 50,
    },
    sortOrder: 1,
  },
  {
    name: "pro",
    displayName: "Pro",
    description: "For growing businesses",
    priceMonthly: 29,
    priceYearly: 290,
    features: [
      "Unlimited recipients",
      "Up to 20 scheduled payments",
      "Team access (5 members)",
      "Split payments",
      "Excel & PDF export",
      "Priority support",
    ],
    limits: {
      max_recipients_per_batch: -1,
      max_scheduled_payments: 20,
      max_team_members: 5,
      max_split_templates: -1,
      transaction_fee_bps: 20,
    },
    sortOrder: 2,
  },
  {
    name: "enterprise",
    displayName: "Enterprise",
    description: "For large organizations",
    priceMonthly: 99,
    priceYearly: 990,
    features: [
      "Everything in Pro",
      "Unlimited team members",
      "Unlimited scheduled payments",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
    ],
    limits: {
      max_recipients_per_batch: -1,
      max_scheduled_payments: -1,
      max_team_members: -1,
      max_split_templates: -1,
      transaction_fee_bps: 0,
    },
    sortOrder: 3,
  },
]

async function main() {
  const { prisma } = await import("@/lib/prisma")

  const columns = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'subscription_plans'`,
  )
  const names = new Set(columns.map((c) => c.column_name))
  if (names.size === 0) {
    console.error("subscription_plans does not exist — run scripts/027_create_saas_billing.sql first (or prisma db push)")
    process.exit(1)
  }
  const wideTable = names.has("display_name")

  const existing = await prisma.subscriptionPlan.count()
  console.log(`table     : subscription_plans (${wideTable ? "SQL shape" : "Prisma shape"})`)
  console.log(`columns   : ${[...names].sort().join(", ")}`)
  console.log(`existing  : ${existing} plan(s)`)

  for (const plan of PLANS) {
    console.log(`  plan ${plan.name.padEnd(11)} $${plan.priceMonthly}/mo — ${wideTable ? "SQL insert" : "Prisma upsert"}`)
  }

  if (process.env.CONFIRM_SEED !== "1") {
    console.log("\nDRY RUN — nothing written. Re-run with CONFIRM_SEED=1.")
    return
  }

  for (const plan of PLANS) {
    if (wideTable) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, features, limits, is_active, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, true, $8)
         ON CONFLICT (name) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           price_monthly = EXCLUDED.price_monthly,
           price_yearly = EXCLUDED.price_yearly,
           features = EXCLUDED.features,
           limits = EXCLUDED.limits,
           sort_order = EXCLUDED.sort_order`,
        plan.name,
        plan.displayName,
        plan.description,
        plan.priceMonthly,
        plan.priceYearly,
        JSON.stringify(plan.features),
        JSON.stringify(plan.limits),
        plan.sortOrder,
      )
    } else {
      await prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        create: {
          name: plan.name,
          price_monthly: plan.priceMonthly,
          features: plan.features,
          limits: plan.limits,
          is_active: true,
        },
        update: {
          price_monthly: plan.priceMonthly,
          features: plan.features,
          limits: plan.limits,
          is_active: true,
        },
      })
    }
  }

  const after = await prisma.subscriptionPlan.findMany({ select: { name: true, price_monthly: true } })
  console.log(`\n✅ seeded. catalogue now: ${after.map((p) => `${p.name}($${p.price_monthly})`).join(", ")}`)
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
