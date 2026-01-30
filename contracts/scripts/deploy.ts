import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying BatchTransfer contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying from account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 手续费收取地址（可以设置为你的钱包地址）
  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS || deployer.address;
  console.log("💵 Fee collector address:", feeCollector);

  // 部署合约
  const BatchTransfer = await ethers.getContractFactory("BatchTransfer");
  const batchTransfer = await BatchTransfer.deploy(feeCollector);

  await batchTransfer.waitForDeployment();
  const contractAddress = await batchTransfer.getAddress();

  console.log("\n✅ BatchTransfer deployed to:", contractAddress);
  console.log("\n📋 Contract Details:");
  console.log("   - Max batch size:", await batchTransfer.maxBatchSize());
  console.log("   - Platform fee:", await batchTransfer.platformFeeBps(), "bps (0 = 0%)");
  console.log("   - Fee collector:", await batchTransfer.feeCollector());

  console.log("\n🔗 Network:", (await ethers.provider.getNetwork()).name);
  console.log("⛽ Gas used:", (await ethers.provider.getTransactionReceipt(batchTransfer.deploymentTransaction()!.hash))?.gasUsed.toString());

  console.log("\n📝 Next steps:");
  console.log("   1. Add this contract address to your .env:");
  console.log(`      NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT=${contractAddress}`);
  console.log("   2. Verify on block explorer (if on mainnet/testnet):");
  console.log(`      npx hardhat verify --network <network> ${contractAddress} ${feeCollector}`);
  console.log("   3. Test the contract with a small batch first");
  console.log("\n✨ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
