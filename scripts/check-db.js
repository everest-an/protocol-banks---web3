// One-off check: verify trading tables exist in the production DB.
const { PrismaClient } = require("@prisma/client")

async function main() {
  require("dotenv").config({ path: require("path").resolve(__dirname, "..", ".env.local") })
  const p = new PrismaClient({ accelerateUrl: process.env.DATABASE_URL })
  const trading = await p.tradingAccount.count()
  console.log("trading_accounts:", trading)
  const users = await p.authUser.count()
  console.log("auth_users:", users)
  const payments = await p.payment.count()
  console.log("payments:", payments)
  await p.$disconnect()
}

main().catch((e) => console.error("FAIL:", e.message))
