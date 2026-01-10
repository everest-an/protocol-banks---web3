import { ethers } from "ethers"

// Constants from lib/web3.ts
const CHAIN_IDS = {
  MAINNET: 1,
  SEPOLIA: 11155111,
  BASE: 8453,
}

const CCTP_TOKEN_MESSENGER_ADDRESSES = {
  [CHAIN_IDS.MAINNET]: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
  [CHAIN_IDS.BASE]: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
  [CHAIN_IDS.SEPOLIA]: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
}

const RPC_URLS = {
  [CHAIN_IDS.MAINNET]: "https://eth.llamarpc.com",
  [CHAIN_IDS.BASE]: "https://mainnet.base.org",
  [CHAIN_IDS.SEPOLIA]: "https://rpc.sepolia.org",
}

async function verifyContract(chainId: number, address: string, name: string) {
  const rpc = RPC_URLS[chainId as keyof typeof RPC_URLS]
  if (!rpc) {
    console.log(`[${name}] No RPC configured for chain ${chainId}`)
    return
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpc)
    const code = await provider.getCode(address)

    if (code === "0x") {
      console.error(`❌ [${name}] Contract NOT FOUND at ${address} on chain ${chainId}`)
    } else {
      console.log(`✅ [${name}] Contract verified at ${address} on chain ${chainId}`)
    }
  } catch (error: any) {
    console.error(`⚠️ [${name}] Failed to verify: ${error.message}`)
  }
}

async function main() {
  console.log("Verifying CCTP TokenMessenger configurations...")

  await verifyContract(CHAIN_IDS.MAINNET, CCTP_TOKEN_MESSENGER_ADDRESSES[CHAIN_IDS.MAINNET], "Mainnet TokenMessenger")
  await verifyContract(CHAIN_IDS.BASE, CCTP_TOKEN_MESSENGER_ADDRESSES[CHAIN_IDS.BASE], "Base TokenMessenger")
  await verifyContract(CHAIN_IDS.SEPOLIA, CCTP_TOKEN_MESSENGER_ADDRESSES[CHAIN_IDS.SEPOLIA], "Sepolia TokenMessenger")
}

main().catch(console.error)
