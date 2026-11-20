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
  type BoundGrant,
} from "@terminal3/t3n-sdk"

async function main() {
  setEnvironment("testnet")
  const apiKey = process.env.T3N_API_KEY
  const agentDid = process.env.T3N_AGENT_DID
  if (!apiKey || !agentDid) throw new Error("Set T3N_API_KEY and T3N_AGENT_DID")

  const wasmPath = path.join(
    process.cwd(),
    "vendor",
    "agent-vault-starter",
    "target",
    "wasm32-wasip2",
    "release",
    "agent_vault_starter.wasm",
  )
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
  const tenant = new TenantClient({ t3n, baseUrl: getNodeUrl(), tenantDid })

  const contract = await tenant.contracts.register({
    tail: "vendor-vault-v2",
    version: "0.1.0",
    wasm: new Uint8Array(fs.readFileSync(wasmPath)),
  })
  console.log("contract:", contract.name, "id:", contract.contract_id)

  try {
    await tenant.maps.create({
      tail: "vault",
      visibility: "private",
      writers: { only: [contract.contract_id] },
      readers: { only: [contract.contract_id] },
    })
    console.log("map: created")
  } catch (error) {
    console.log("map create returned:", error instanceof Error ? error.message : error)
    await tenant.maps.update("vault", {
      writers: { only: [contract.contract_id] },
      readers: { only: [contract.contract_id] },
    })
    console.log("map: ACL updated")
  }

  const record = {
    full_name: "Protocol Bank Demo Vendor",
    date_of_birth: "1990-04-12",
    nationality: "HK",
    residential_address: { line1: "1 Demo Street", city: "Hong Kong", postcode: "000000", country: "HK" },
    email: "vendor@example.com",
    phone: "+85200000000",
    national_id: { type: "passport", number: "000000000", issuing_country: "HK", expires_on: "2031-04-11" },
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

  const stored = await t3n.executeAndDecode({
    contract_id: contract.name,
    contract_version: "0.1.0",
    function_name: "store",
    input: record,
  })
  console.log("stored:", stored)

  await t3n.updateMemberDelegation(
    fanOutGrant<BoundGrant>(
      { grantee: agentDid, contract_id: contract.name, scopes: [], allowed_hosts: [] },
      ["check"],
    ),
  )
  console.log("granted check")

  console.log("\nSet these in .env.local and Vercel:")
  console.log(`T3N_AGENT_API_KEY=${process.env.T3N_AGENT_API_KEY ?? ""}`)
  console.log(`T3N_CONTRACT_ID=${contract.name}`)
  console.log(`T3N_CUSTOMER_DID=${tenantDid}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exit(1)
})
