import { ethers } from "ethers"

// Configuration
// ------------------------------------------------------------------
// ⚠️ SECURITY WARNING: NEVER COMMIT YOUR PRIVATE KEY TO GIT ⚠️
// Run this script with: MNEMONIC="your words here" npx ts-node scripts/test-cctp-transfer.ts
// ------------------------------------------------------------------

const MNEMONIC = process.env.MNEMONIC

// Constants
const BASE_RPC = "https://mainnet.base.org"
const BASE_CHAIN_ID = 8453
const USDC_ADDRESS_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const TOKEN_MESSENGER_BASE = "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d"

// Destination: Ethereum Mainnet (Domain 0)
const DESTINATION_DOMAIN = 0

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
]

const CCTP_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)",
]

async function main() {
  if (!MNEMONIC) {
    console.error("❌ Missing MNEMONIC environment variable.")
    console.error('Usage: MNEMONIC="your twelve words..." npx ts-node scripts/test-cctp-transfer.ts')
    process.exit(1)
  }

  console.log("Initializing Wallet...")
  const provider = new ethers.JsonRpcProvider(BASE_RPC)
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider)

  console.log(`Wallet Address: ${wallet.address}`)

  // 1. Check ETH Balance (for gas)
  const ethBalance = await provider.getBalance(wallet.address)
  console.log(`ETH Balance: ${ethers.formatEther(ethBalance)} ETH`)

  if (ethBalance === 0n) {
    console.error("❌ No ETH for gas. Please fund your wallet on Base.")
    return
  }

  // 2. Check USDC Balance
  const usdc = new ethers.Contract(USDC_ADDRESS_BASE, ERC20_ABI, wallet)
  const decimals = await usdc.decimals()
  const balance = await usdc.balanceOf(wallet.address)

  console.log(`USDC Balance: ${ethers.formatUnits(balance, decimals)} USDC`)

  if (balance === 0n) {
    console.error("❌ No USDC found to test.")
    return
  }

  // 3. Prepare Transfer (Test 0.1 USDC)
  const amountToTest = ethers.parseUnits("0.1", decimals)
  if (balance < amountToTest) {
    console.warn("⚠️ Balance less than 0.1 USDC, attempting to send entire balance...")
  }

  const amount = balance < amountToTest ? balance : amountToTest
  console.log(`Attempting to transfer ${ethers.formatUnits(amount, decimals)} USDC via CCTP...`)

  // 4. Approve TokenMessenger
  const messengerAddress = TOKEN_MESSENGER_BASE
  const currentAllowance = await usdc.allowance(wallet.address, messengerAddress)

  if (currentAllowance < amount) {
    console.log("Approving TokenMessenger...")
    const tx = await usdc.approve(messengerAddress, amount)
    console.log(`Approval Tx sent: ${tx.hash}`)
    await tx.wait()
    console.log("Approved.")
  } else {
    console.log("Already approved.")
  }

  // 5. Execute depositForBurn
  const messenger = new ethers.Contract(messengerAddress, CCTP_ABI, wallet)
  const mintRecipient = ethers.zeroPadValue(wallet.address, 32) // Send to self on destination

  console.log("Sending depositForBurn transaction...")
  try {
    const burnTx = await messenger.depositForBurn(amount, DESTINATION_DOMAIN, mintRecipient, USDC_ADDRESS_BASE)
    console.log(`✅ Transaction Sent! Hash: ${burnTx.hash}`)
    console.log("Wait for block confirmation...")
    await burnTx.wait()
    console.log("Transaction confirmed on Base.")
    console.log(`You can check the status on Circle's CCTP Explorer with the tx hash.`)
  } catch (err: any) {
    console.error("❌ Transaction failed:", err.message)
  }
}

main().catch(console.error)
