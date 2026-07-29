import { ethers, network } from "hardhat";

/**
 * Deploy SubscriptionManager.
 *
 * The owner's only power is pause/unpause, which can halt charges but can never
 * move, redirect, or increase them — user funds never enter this contract. Set
 * SUBSCRIPTION_MANAGER_OWNER to a multisig for production deployments.
 */
async function main() {
  console.log("🚀 Deploying SubscriptionManager...\n");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("📍 Network:", network.name);
  console.log("📍 Deploying from:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  const owner = process.env.SUBSCRIPTION_MANAGER_OWNER || deployer.address;
  if (!process.env.SUBSCRIPTION_MANAGER_OWNER) {
    console.warn(
      "⚠️  SUBSCRIPTION_MANAGER_OWNER not set — the deployer EOA will hold the pause key.\n" +
        "   Use a multisig for production.\n"
    );
  }
  console.log("🔑 Owner (pause key):", owner);

  const Factory = await ethers.getContractFactory("SubscriptionManager");
  const manager = await Factory.deploy(owner);
  await manager.waitForDeployment();

  const address = await manager.getAddress();
  console.log("\n✅ SubscriptionManager deployed to:", address);

  console.log("\n📋 Next steps:");
  console.log("   1. Verify:  npx hardhat verify --network", network.name, address, owner);
  console.log("   2. Record the address for chain", (await ethers.provider.getNetwork()).chainId);
  console.log("      → lib/services/subscription-manager-contract.ts");
  console.log("   3. Allowlist each token before it can be used:");
  console.log("        manager.setTokenAllowed(<token>, true)");
  console.log("      Only standard ERC-20s — fee-on-transfer and rebasing tokens");
  console.log("      deliver less than the charged amount.");
  console.log("   4. Confirm the token implements EIP-2612 permit on this chain");
  console.log("   5. Hand ownership to a multisig (Ownable2Step: transfer, then accept)");

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
