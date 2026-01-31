const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Deploying BatchTransfer contract...");
  console.log("Deployer address:", deployer.address);
  console.log("Network:", hre.network.name);
  
  // Fee collector address - use deployer as default, should be changed in production
  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS || deployer.address;
  console.log("Fee collector:", feeCollector);
  
  // Get balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "ETH");
  
  // Deploy contract
  const BatchTransfer = await hre.ethers.getContractFactory("BatchTransfer");
  const batchTransfer = await BatchTransfer.deploy(feeCollector);
  
  await batchTransfer.waitForDeployment();
  const contractAddress = await batchTransfer.getAddress();
  
  console.log("\n=================================");
  console.log("BatchTransfer deployed to:", contractAddress);
  console.log("=================================\n");
  
  // Wait for block confirmations for verification
  console.log("Waiting for block confirmations...");
  await batchTransfer.deploymentTransaction().wait(5);
  
  // Verify on block explorer
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Verifying contract on block explorer...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [feeCollector],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract already verified");
      } else {
        console.error("Verification failed:", error.message);
      }
    }
  }
  
  // Output deployment info for .env
  console.log("\n=== Add to your .env file ===");
  console.log(`NEXT_PUBLIC_BATCH_TRANSFER_CONTRACT_${hre.network.name.toUpperCase()}=${contractAddress}`);
  
  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
