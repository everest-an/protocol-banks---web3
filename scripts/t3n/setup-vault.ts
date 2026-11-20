/**
 * One-time T3N setup for the Protocol Bank private vendor vault.
 *
 * Requires T3N_API_KEY from https://terminal3.io/claim-page and the compiled
 * agent-vault-starter WASM. Prints the three runtime values used by
 * /api/t3n/vendor-check:
 *
 *   T3N_AGENT_API_KEY
 *   T3N_CONTRACT_ID
 *   T3N_CUSTOMER_DID
 *
 * Run:
 *   T3N_API_KEY=t3n_... npx tsx scripts/t3n/setup-vault.ts
 */
import fs from "fs"
import path from "path"
import {
  T3nClient,
  TenantClient,
  setEnvironment,
  loadWasmComponent,
  resolveTrustAnchor,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
  getNodeUrl,
  fanOutGrant,
  toBaseUnits,
  type BoundGrant,
} from "@terminal3/t3n-sdk"

async function main() {
setEnvironment("testnet")

const apiKey = process.env.T3N_API_KEY
if (!apiKey) throw new Error("Set T3N_API_KEY first")

const wasmPath = path.join(
  process.cwd(),
  "vendor",
  "agent-vault-starter",
  "target",
  "wasm32-wasip2",
  "release",
  "agent_vault_starter.wasm",
)
if (!fs.existsSync(wasmPath)) {
  throw new Error(`Build the vault contract first: ${wasmPath}`)
}

const wasmComponent = await loadWasmComponent()
const address = eth_get_address(apiKey)
const t3n = new T3nClient({
  trustAnchor: await resolveTrustAnchor("testnet"),
  wasmComponent,
  handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
})
await t3n.handshake()
const did = await t3n.authenticate(createEthAuthInput(address))
const tenantDid = did.value
console.log("tenant:", tenantDid)

const orgDid = (await t3n.createOrganisation("Protocol Bank Aevum")).value
console.log("org:", orgDid)

const agent = await t3n.createAgent(orgDid, "Vendor Vault Checker")
const agentDid = agent.agentDid.value
console.log("agent:", agentDid)
console.log("agent key (save once):", agent.apiKey)
await t3n.fundAgent(agentDid, toBaseUnits(5))

const tenant = new TenantClient({ t3n, baseUrl: getNodeUrl(), tenantDid })
await tenant.tenant.me()

const contract = await tenant.contracts.register({
  tail: "vendor-vault",
  version: "0.1.0",
  wasm: new Uint8Array(fs.readFileSync(wasmPath)),
})
console.log("contract:", contract.name)

// The contract reads and writes only its own map.
await tenant.maps.create({
  tail: "vault",
  visibility: "private",
  writers: { only: [contract.contract_id] },
  readers: { only: [contract.contract_id] },
})

const record = {
  full_name: "Protocol Bank Demo Vendor",
  date_of_birth: "1990-04-12",
  nationality: "HK",
  residential_address: { line1: "1 Demo Street", city: "Hong Kong", postcode: "000000", country: "HK" },
  email: "vendor@example.com",
  phone: "+85200000000",
  national_id: {
    type: "passport",
    number: "000000000",
    issuing_country: "HK",
    expires_on: "2031-04-11",
  },
  kyc: { status: "verified", verified_on: "2026-01-20" },
  account: {
    iban: "HK00DEMO000000000000000",
    sort_code: "00-00-00",
    account_number: "00000000",
    type: "current",
    currency: "USD",
    opened_on: "2024-06-03",
    balance_cents: 452300,
  },
  employment: { status: "self_employed", employer: "Protocol Bank", monthly_net_income_cents: 385000 },
  tax_residency: "HK",
}

await t3n.executeAndDecode({
  contract_id: contract.name,
  contract_version: "0.1.0",
  function_name: "store",
  input: record,
})

await t3n.updateMemberDelegation(
  fanOutGrant<BoundGrant>(
    {
      grantee: agentDid,
      contract_id: contract.name,
      scopes: [],
      allowed_hosts: [],
    },
    ["check"],
  ),
)

console.log("\nSet these in .env.local and Vercel:")
console.log(`T3N_AGENT_API_KEY=${agent.apiKey}`)
console.log(`T3N_CONTRACT_ID=${contract.name}`)
console.log(`T3N_CUSTOMER_DID=${tenantDid}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
