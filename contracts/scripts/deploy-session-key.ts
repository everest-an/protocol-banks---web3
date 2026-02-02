import hre from "hardhat";
import * as dotenv from "dotenv";

const ethers = hre.ethers;

dotenv.config();

/**
 * 部署 SessionKeyValidator 合约到多个链
 * 
 * 使用方法:
 *   npx hardhat run scripts/deploy-session-key.ts --network base
 *   npx hardhat run scripts/deploy-session-key.ts --network baseSepolia
 *   npx hardhat run scripts/deploy-session-key.ts --network hashkey
 *   npx hardhat run scripts/deploy-session-key.ts --network hashkeyTestnet
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("Deploying SessionKeyValidator");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log("=".repeat(60));

  // 部署合约
  console.log("\n📦 Deploying SessionKeyValidator...");
  const SessionKeyValidator = await ethers.getContractFactory("SessionKeyValidator");
  const sessionKeyValidator = await SessionKeyValidator.deploy();

  await sessionKeyValidator.waitForDeployment();
  const contractAddress = await sessionKeyValidator.getAddress();

  console.log(`✅ SessionKeyValidator deployed to: ${contractAddress}`);

  // 验证部署
  console.log("\n🔍 Verifying deployment...");
  const owner = await sessionKeyValidator.owner();
  const minDuration = await sessionKeyValidator.minSessionDuration();
  const maxDuration = await sessionKeyValidator.maxSessionDuration();

  console.log(`   Owner: ${owner}`);
  console.log(`   Min Session Duration: ${Number(minDuration) / 3600} hours`);
  console.log(`   Max Session Duration: ${Number(maxDuration) / 86400} days`);

  // 输出部署信息
  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Block: ${await ethers.provider.getBlockNumber()}`);
  console.log("=".repeat(60));

  // 保存部署信息到文件
  const deploymentInfo = {
    network: network.name,
    chainId: Number(network.chainId),
    contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  console.log("\n📄 Deployment Info (save this):");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // 验证提示
  console.log("\n💡 To verify on explorer, run:");
  console.log(`   npx hardhat verify --network ${network.name} ${contractAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
