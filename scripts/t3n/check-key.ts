import {
  T3nClient,
  setEnvironment,
  loadWasmComponent,
  resolveTrustAnchor,
  eth_get_address,
  metamask_sign,
  createEthAuthInput,
} from "@terminal3/t3n-sdk"

async function main() {
  setEnvironment("testnet")
  const key = process.env.T3N_API_KEY
  if (!key) throw new Error("T3N_API_KEY is missing")
  const wasmComponent = await loadWasmComponent()
  const address = eth_get_address(key)
  const t3n = new T3nClient({
    trustAnchor: await resolveTrustAnchor("testnet"),
    wasmComponent,
    handlers: { EthSign: metamask_sign(address, undefined, key) },
  })
  await t3n.handshake()
  const did = await t3n.authenticate(createEthAuthInput(address))
  console.log("T3N connected:", did.value)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
