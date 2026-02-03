import hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

const { ethers, upgrades } = hre;

/**
 * 部署可升级版本的 SessionKeyValidator 合约
 * 使用 UUPS 代理模式，支持日后升级
 * 
 * 使用方法:
 *   npx hardhat run scripts/deploy-upgradeable.ts --network base
 *   npx hardhat run scripts/deploy-upgradeable.ts --network hashkey
 */

async function main() {
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    throw new Error("No signers available. Please set PRIVATE_KEY in .env file");
  }
  
  const deployer = signers[0];
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("Deploying SessionKeyValidatorUpgradeable (UUPS Proxy)");
  console.log("=".repeat(60));
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
  console.log("=".repeat(60));

  if (parseFloat(ethers.formatEther(balance)) < 0.001) {
    throw new Error("Insufficient balance for deployment. Need at least 0.001 ETH");
  }

  // 部署可升级合约
  console.log("\n📦 Deploying SessionKeyValidatorUpgradeable...");
  const SessionKeyValidator = await ethers.getContractFactory("SessionKeyValidatorUpgradeable");
  
  const proxy = await upgrades.deployProxy(SessionKeyValidator, [], {
    initializer: "initialize",
    kind: "uups",
    txOverrides: {
      gasLimit: 5000000,
    },
  });

  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  
  // 等待几个区块确认
  console.log("   Waiting for confirmations...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  let implementationAddress;
  try {
    implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  } catch {
    implementationAddress = "Unable to fetch (check on explorer)";
  }

  console.log(`\n✅ Deployment successful!`);
  console.log(`   Proxy Address: ${proxyAddress}`);
  console.log(`   Implementation Address: ${implementationAddress}`);

  // 验证部署
  console.log("\n🔍 Verifying deployment...");
  const owner = await proxy.owner();
  const version = await proxy.getVersion();
  const minDuration = await proxy.minSessionDuration();
  const maxDuration = await proxy.maxSessionDuration();

  console.log(`   Owner: ${owner}`);
  console.log(`   Version: ${version}`);
  console.log(`   Min Session Duration: ${Number(minDuration) / 3600} hours`);
  console.log(`   Max Session Duration: ${Number(maxDuration) / 86400} days`);

  // 输出部署信息
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log(`
Chain ID: ${network.chainId}
Proxy Address: ${proxyAddress}
Implementation: ${implementationAddress}

⚠️  IMPORTANT: Save these addresses!

Add to your .env file:
SESSION_KEY_CONTRACT_${network.chainId}=${proxyAddress}

For future upgrades, use:
npx hardhat run scripts/upgrade-session-key.ts --network <network>
`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
