import { ethers, network } from "hardhat";

/**
 * Post-deployment verification.
 *
 * Reads a deployed SubscriptionManager back from chain and checks it is
 * configured the way the app expects. Run this after every deployment — a
 * contract that is deployed but not allowlisted, or owned by the wrong address,
 * fails silently at the first charge rather than at deploy time.
 *
 * Usage:
 *   MANAGER_ADDRESS=0x... TOKENS=0xUSDC,0xUSDT \
 *     npx hardhat run scripts/verify-deployment.ts --network arbitrum
 */
async function main() {
  const address = process.env.MANAGER_ADDRESS;
  if (!address) throw new Error("Set MANAGER_ADDRESS to the deployed contract");

  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log(`\n🔍 Verifying SubscriptionManager on ${network.name} (chain ${chainId})`);
  console.log(`   ${address}\n`);

  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    throw new Error(`No contract deployed at ${address} on ${network.name}`);
  }
  console.log(`✅ Bytecode present (${(code.length - 2) / 2} bytes)`);

  const manager = await ethers.getContractAt("SubscriptionManager", address);

  const [owner, pendingOwner, paused, maxPeriod, maxNotice] = await Promise.all([
    manager.owner(),
    manager.pendingOwner(),
    manager.paused(),
    manager.MAX_PERIOD_SECONDS(),
    manager.MAX_NOTICE_SECONDS(),
  ]);

  console.log(`   owner              ${owner}`);
  if (pendingOwner !== ethers.ZeroAddress) {
    console.log(`   ⏳ pending owner    ${pendingOwner} (must call acceptOwnership)`);
  }
  console.log(`   paused             ${paused}`);
  console.log(`   MAX_PERIOD_SECONDS ${maxPeriod} (${Number(maxPeriod) / 86400} days)`);
  console.log(`   MAX_NOTICE_SECONDS ${maxNotice} (${Number(maxNotice) / 86400} days)`);

  if (paused) {
    console.log("\n⚠️  Contract is PAUSED — no charges will execute.");
  }

  // An EOA owner holds the pause key on a live payments contract.
  if ((await ethers.provider.getCode(owner)) === "0x") {
    console.log("\n⚠️  Owner is an EOA, not a contract. Use a multisig in production.");
  }

  const tokens = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    console.log("\n⚠️  No TOKENS given to check. Without an allowlisted token, every");
    console.log("    createSubscription call reverts with TokenNotAllowed.");
  } else {
    console.log("\n📋 Token allowlist:");
    let missing = 0;
    for (const token of tokens) {
      const allowed = await manager.allowedTokens(token);
      console.log(`   ${allowed ? "✅" : "❌"} ${token}`);
      if (!allowed) missing++;
    }
    if (missing > 0) {
      console.log(`\n⚠️  ${missing} token(s) not allowlisted. Run:`);
      console.log(`    manager.setTokenAllowed(<token>, true)`);
    }
  }

  console.log("\n📌 Record this in lib/services/subscription-manager-contract.ts:");
  console.log(`      ${chainId}: '${address}',`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌", error.message);
    process.exit(1);
  });
