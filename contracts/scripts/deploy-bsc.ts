import { ethers } from "hardhat";

/**
 * Deploy BatchTransfer + PaymentSplitter + PaymentVault to BSC
 *
 * Usage:
 *   # BSC Testnet
 *   npx hardhat run scripts/deploy-bsc.ts --network bscTestnet
 *
 *   # BSC Mainnet
 *   npx hardhat run scripts/deploy-bsc.ts --network bsc
 *
 * Required env vars:
 *   PRIVATE_KEY          - Deployer wallet private key
 *   FEE_COLLECTOR_ADDRESS - (optional) Fee collector, defaults to deployer
 *   BSCSCAN_API_KEY      - (optional) For contract verification
 */

// BSC Token addresses
const BSC_TOKENS = {
  mainnet: {
    USDT: "0x55d398326f99059fF775485246999027B3197955",
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    DAI: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  },
  testnet: {
    USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
    BUSD: "0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee",
  },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isTestnet = chainId === 97;
  const networkName = isTestnet ? "BSC Testnet" : "BSC Mainnet";

  console.log(`\n🚀 Deploying to ${networkName} (chainId: ${chainId})\n`);
  console.log(`📍 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} BNB\n`);

  if (balance === 0n) {
    console.error("❌ Deployer has no BNB for gas!");
    console.log(
      isTestnet
        ? "💡 Get testnet BNB: https://www.bnbchain.org/en/testnet-faucet"
        : "💡 Fund your wallet with BNB first"
    );
    process.exit(1);
  }

  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS || deployer.address;
  const tokens = isTestnet ? BSC_TOKENS.testnet : BSC_TOKENS.mainnet;
  const supportedTokenAddresses = Object.values(tokens);

  const results: Record<string, string> = {};

  // ── 1. Deploy BatchTransfer ──────────────────────────────────
  console.log("━".repeat(50));
  console.log("📦 [1/3] Deploying BatchTransfer...");
  try {
    const BatchTransfer = await ethers.getContractFactory("BatchTransfer");
    const batchTransfer = await BatchTransfer.deploy(feeCollector);
    await batchTransfer.waitForDeployment();
    const addr = await batchTransfer.getAddress();
    results.BatchTransfer = addr;
    console.log(`   ✅ BatchTransfer: ${addr}`);
  } catch (err: any) {
    console.log(`   ⚠️  BatchTransfer skipped: ${err.message?.slice(0, 80)}`);
  }

  // ── 2. Deploy PaymentSplitter ────────────────────────────────
  console.log("📦 [2/3] Deploying PaymentSplitter...");
  try {
    const Splitter = await ethers.getContractFactory("TronPaymentSplitter");
    const splitter = await Splitter.deploy(deployer.address, supportedTokenAddresses);
    await splitter.waitForDeployment();
    const addr = await splitter.getAddress();
    results.PaymentSplitter = addr;
    console.log(`   ✅ PaymentSplitter: ${addr}`);
  } catch (err: any) {
    console.log(`   ⚠️  PaymentSplitter skipped: ${err.message?.slice(0, 80)}`);
  }

  // ── 3. Deploy PaymentVault ───────────────────────────────────
  console.log("📦 [3/3] Deploying PaymentVault...");
  try {
    const Vault = await ethers.getContractFactory("TronPaymentVault");
    const vault = await Vault.deploy(
      [deployer.address],       // initial signers
      1,                        // threshold (1-of-1 for now, increase later)
      deployer.address,         // guardian
      supportedTokenAddresses,  // supported tokens
      0,                        // timelock (0 = disabled, set later)
      0                         // daily limit (0 = unlimited, set later)
    );
    await vault.waitForDeployment();
    const addr = await vault.getAddress();
    results.PaymentVault = addr;
    console.log(`   ✅ PaymentVault: ${addr}`);
  } catch (err: any) {
    console.log(`   ⚠️  PaymentVault skipped: ${err.message?.slice(0, 80)}`);
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log("\n" + "━".repeat(50));
  console.log(`✅ Deployment complete on ${networkName}\n`);

  console.log("📋 Contract Addresses:");
  for (const [name, addr] of Object.entries(results)) {
    console.log(`   ${name}: ${addr}`);
  }

  const explorer = isTestnet
    ? "https://testnet.bscscan.com"
    : "https://bscscan.com";

  console.log(`\n🔗 Block Explorer: ${explorer}`);
  for (const [name, addr] of Object.entries(results)) {
    console.log(`   ${name}: ${explorer}/address/${addr}`);
  }

  console.log("\n📝 Add to .env:");
  if (results.BatchTransfer) {
    console.log(`   NEXT_PUBLIC_BSC_BATCH_TRANSFER=${results.BatchTransfer}`);
  }
  if (results.PaymentSplitter) {
    console.log(`   NEXT_PUBLIC_BSC_PAYMENT_SPLITTER=${results.PaymentSplitter}`);
  }
  if (results.PaymentVault) {
    console.log(`   NEXT_PUBLIC_BSC_PAYMENT_VAULT=${results.PaymentVault}`);
  }

  console.log("\n📝 Verify contracts:");
  if (results.BatchTransfer) {
    console.log(
      `   npx hardhat verify --network ${isTestnet ? "bscTestnet" : "bsc"} ${results.BatchTransfer} ${feeCollector}`
    );
  }
  if (results.PaymentSplitter) {
    console.log(
      `   npx hardhat verify --network ${isTestnet ? "bscTestnet" : "bsc"} ${results.PaymentSplitter} ${deployer.address} "[${supportedTokenAddresses.map((a) => `\\"${a}\\"`).join(",")}]"`
    );
  }

  console.log("\n✨ Done!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
