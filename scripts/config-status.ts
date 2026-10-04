/**
 * Integration readiness report — which optional services are configured.
 *
 *   $env:DOTENV_CONFIG_PATH='.env.local'; npx tsx -r dotenv/config scripts/config-status.ts
 *
 * Read-only: inspects environment variables only. Use it before go-live to see
 * which surfaces are ready and what each missing key blocks.
 */
import { JsonRpcProvider, Wallet, formatEther } from "ethers"
import { prisma } from "@/lib/prisma"
import { yativoClient } from "@/lib/services/yativo-client.service"

const has = (...keys: string[]) => keys.every((key) => !!process.env[key])
const any = (...keys: string[]) => keys.some((key) => !!process.env[key])

interface Row {
  area: string
  ready: boolean
  detail: string
  blocks: string
}

const rows: Row[] = [
  {
    area: "Database",
    ready: has("DATABASE_URL") || has("DIRECT_DATABASE_URL"),
    detail: has("DIRECT_DATABASE_URL") ? "direct (DIRECT_DATABASE_URL)" : has("DATABASE_URL") ? "DATABASE_URL only" : "missing",
    blocks: "everything",
  },
  {
    area: "Auth (JWT)",
    ready: has("AI_JWT_SECRET"),
    detail: has("AI_JWT_SECRET") ? "set" : "missing — getJwtSecret() throws",
    blocks: "login + all authenticated routes",
  },
  {
    area: "Local relayer (payouts)",
    ready: has("RELAYER_PRIVATE_KEY"),
    detail: has("RELAYER_PRIVATE_KEY") ? "set" : "missing",
    blocks: "batch/payout execution (funds + gas)",
  },
  {
    area: "Hosted relayer",
    ready: has("RELAYER_API_KEY", "RELAYER_URL"),
    detail: has("RELAYER_API_KEY", "RELAYER_URL") ? "set" : "missing",
    blocks: "subscription charging, x402 settlement",
  },
  {
    area: "Off-ramp provider",
    ready: any("BRIDGE_API_KEY", "COINBASE_ONRAMP_API_KEY", "TRANSAK_API_KEY"),
    detail: any("BRIDGE_API_KEY", "COINBASE_ONRAMP_API_KEY", "TRANSAK_API_KEY") ? "at least one set" : "none set",
    blocks: "off-ramp quotes/execution (503)",
  },
  {
    area: "Cards (Yativo)",
    ready: has("YATIVO_API_KEY", "YATIVO_API_SECRET"),
    detail: has("YATIVO_API_KEY", "YATIVO_API_SECRET") ? "set" : "missing",
    blocks: "card funding",
  },
  {
    area: "Asset distribution",
    ready: has("ASSET_DISTRIBUTOR_ADDRESS", "ASSET_DISTRIBUTOR_PRIVATE_KEY"),
    detail: has("ASSET_DISTRIBUTOR_ADDRESS", "ASSET_DISTRIBUTOR_PRIVATE_KEY") ? "set" : "missing",
    blocks: "post-payment NFT/token distribution (503)",
  },
  {
    area: "Batch contract (legacy)",
    ready: has("NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT"),
    detail: has("NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT") ? "set" : "missing",
    blocks: "legacy contract batch path (USDC batches use EIP-3009)",
  },
  {
    area: "RLS enforcement",
    ready: process.env.RLS_MODE === "enforce",
    detail: process.env.RLS_MODE === "enforce" ? "enforce" : "off (policies inert)",
    blocks: "database-enforced tenant isolation (see ENV_SETUP 6c)",
  },
  {
    area: "Mock execution",
    ready: process.env.ALLOW_MOCK_EXECUTION !== "true",
    detail: process.env.ALLOW_MOCK_EXECUTION === "true" ? "ENABLED — must be false in production" : "disabled",
    blocks: "—",
  },
]

console.log("Integration readiness\n")
for (const row of rows) {
  console.log(
    `${row.ready ? "✅" : "⚠️ "} ${row.area.padEnd(28)} ${row.detail.padEnd(38)} blocks: ${row.blocks}`,
  )
}

const gaps = rows.filter((row) => !row.ready)
console.log(`\n${gaps.length} gap(s): ${gaps.map((gap) => gap.area).join(", ") || "none"}`)

// ── Live probes (only with --probe) ─────────────────────────────────────────
// Env presence does not mean the credentials work — this actually connects.
if (process.argv.includes("--probe")) {
  void (async () => {
    console.log("\nLive probes\n")

    try {
      await prisma.$queryRawUnsafe("SELECT 1")
      console.log("✅ Database                 connected")
    } catch (error) {
      console.log(`❌ Database                 ${String((error as Error)?.message ?? error).slice(0, 90)}`)
    }

    if (process.env.RELAYER_PRIVATE_KEY) {
      try {
        const wallet = new Wallet(process.env.RELAYER_PRIVATE_KEY)
        const rpc = new JsonRpcProvider(
          process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com",
          undefined,
          { staticNetwork: true },
        )
        const balance = await rpc.getBalance(wallet.address)
        console.log(`✅ Local relayer            ${wallet.address.slice(0, 10)}… · ${formatEther(balance)} Sepolia ETH`)
      } catch (error) {
        console.log(`❌ Local relayer            ${String((error as Error)?.message ?? error).slice(0, 90)}`)
      }
    }

    if (process.env.YATIVO_API_KEY && process.env.YATIVO_API_SECRET) {
      try {
        await yativoClient.getBusinessDetails()
        console.log("✅ Yativo (cards)           authenticated")
      } catch (error) {
        console.log(`❌ Yativo (cards)           ${String((error as Error)?.message ?? error).slice(0, 110)}`)
      }
    }
  })()
}
