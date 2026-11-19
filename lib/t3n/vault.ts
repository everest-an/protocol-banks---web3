export interface T3nVendorRules {
  kyc_verified?: boolean
  residency_in?: string[]
  min_age?: number
  id_not_expired?: boolean
  account_open_min_months?: number
}

export interface T3nVendorCheckResult {
  answers: Record<string, boolean>
  allPassed: boolean
  configured: boolean
  customerDid: string | null
  contractId: string | null
}

export function getT3nConfig() {
  return {
    agentApiKey: process.env.T3N_AGENT_API_KEY || "",
    contractId: process.env.T3N_CONTRACT_ID || "",
    customerDid: process.env.T3N_CUSTOMER_DID || "",
  }
}

export function isT3nConfigured(): boolean {
  const config = getT3nConfig()
  return Boolean(config.agentApiKey && config.contractId && config.customerDid)
}

/**
 * Agent-side check. The agent gets booleans only; the vendor record never
 * enters this process. The data owner grants this agent `check` on the vault.
 */
export async function checkVendorRules(rules: T3nVendorRules): Promise<T3nVendorCheckResult> {
  const config = getT3nConfig()
  if (!isT3nConfigured()) {
    return {
      answers: {},
      allPassed: false,
      configured: false,
      customerDid: config.customerDid || null,
      contractId: config.contractId || null,
    }
  }

  const { invoke, setEnvironment, getNodeUrl, getContractVersion } = await import("@terminal3/t3n-sdk")
  setEnvironment("testnet")
  const contractVersion = await getContractVersion(getNodeUrl(), config.contractId)
  const result = (await invoke({
    baseUrl: getNodeUrl(),
    apiKey: config.agentApiKey,
    request: {
      contract_id: config.contractId,
      contract_version: contractVersion,
      function_name: "check",
      pii_did: config.customerDid,
      input: { rules },
    },
  })) as { answers?: Record<string, boolean> }

  const answers = result.answers ?? {}
  return {
    answers,
    allPassed: Object.values(answers).every(Boolean),
    configured: true,
    customerDid: config.customerDid,
    contractId: config.contractId,
  }
}
