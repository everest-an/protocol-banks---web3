import {
  T3nClient,
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
  const agentDid = process.env.T3N_AGENT_DID
  const contractId = process.env.T3N_CONTRACT_ID
  if (!apiKey || !agentDid || !contractId) throw new Error("missing env")
  const wasmComponent = await loadWasmComponent()
  const address = eth_get_address(apiKey)
  const t3n = new T3nClient({
    trustAnchor: await resolveTrustAnchor("testnet"),
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, apiKey) },
  })
  await t3n.handshake()
  await t3n.authenticate(createEthAuthInput(address))
  await t3n.fundAgent(agentDid, toBaseUnits(50))
  await t3n.updateMemberDelegation(
    fanOutGrant<BoundGrant>(
      { grantee: agentDid, contract_id: contractId, scopes: [], allowed_hosts: [] },
      ["check"],
    ),
  )
  console.log("funded and granted")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
