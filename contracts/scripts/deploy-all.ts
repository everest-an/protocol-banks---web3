import { ethers, network } from "hardhat";

/**
 * One-shot testnet bring-up: deploy, allowlist, verify.
 *
 * Each step is checked before the next runs, so a partial failure stops with a
 * clear reason rather than leaving a half-configured contract that fails at the
 * first charge.
 *
 * Usage:
 *   TOKENS=0x<usdc>[,0x<other>] \
 *     npx hardhat run scripts/deploy-all.ts --network arbitrumSepolia
 *
 * Optional:
 *   SUBSCRIPTION_MANAGER_OWNER=0x<multisig>   // defaults to the deployer
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — is PRIVATE_KEY set in contracts/.env?");

  const chainId = (await ethers.provider.getNetwork()).chainId;
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`\n🚀 SubscriptionManager bring-up on ${network.name} (chain ${chainId})`);
  console.log(`   deployer  ${deployer.address}`);
  console.log(`   balance   ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error(
      `${deployer.address} has no ETH on ${network.name}. Fund it from a faucet first.`
    );
  }

  // ── 1. Deploy ────────────────────────────────────────────────────────────
  const owner = process.env.SUBSCRIPTION_MANAGER_OWNER || deployer.address;
  if (!process.env.SUBSCRIPTION_MANAGER_OWNER) {
    console.log("⚠️  SUBSCRIPTION_MANAGER_OWNER not set — the deployer EOA keeps the pause key.");
    console.log("   Fine for a testnet; use a multisig for production.\n");
  }

  const Factory = await ethers.getContractFactory("SubscriptionManager");
  const manager = await Factory.deploy(owner);
  await manager.waitForDeployment();
  const address = await manager.getAddress();

  console.log(`✅ Deployed at ${address}`);
  console.log(`   owner ${owner}\n`);

  // ── 2. Allowlist tokens ──────────────────────────────────────────────────
  const tokens = (process.env.TOKENS || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    console.log("⚠️  No TOKENS given. Until a token is allowlisted, every");
    console.log("   createSubscription call reverts with TokenNotAllowed.\n");
  } else {
    for (const token of tokens) {
      const erc20 = await ethers.getContractAt(
        [
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function nonces(address) view returns (uint256)",
        ],
        token
      );

      let symbol: string;
      try {
        symbol = await erc20.symbol();
      } catch {
        throw new Error(`${token} does not look like an ERC-20 on ${network.name}`);
      }

      let hasPermit = true;
      try {
        await erc20.nonces(deployer.address);
      } catch {
        hasPermit = false;
      }

      const tx = await manager.setTokenAllowed(token, true);
      await tx.wait();

      if (!(await manager.allowedTokens(token))) {
        throw new Error(`setTokenAllowed mined but ${token} is still not allowed`);
      }

      console.log(`✅ Allowlisted ${symbol} ${token}`);
      if (!hasPermit) {
        console.log("   ⚠️  No EIP-2612 permit — createSubscriptionWithPermit will revert.");
        console.log("      Payers must approve() first, then createSubscription().");
      }
    }
    console.log("");
  }

  // ── 3. Verify final state ────────────────────────────────────────────────
  const [finalOwner, paused] = await Promise.all([manager.owner(), manager.paused()]);
  const code = await ethers.provider.getCode(address);

  console.log("🔍 Final state");
  console.log(`   bytecode  ${(code.length - 2) / 2} bytes`);
  console.log(`   owner     ${finalOwner}`);
  console.log(`   paused    ${paused}`);

  if (code === "0x") throw new Error("No bytecode at the deployed address");
  if (paused) throw new Error("Contract deployed in a paused state");

  console.log("\n📌 Add to lib/services/subscription-manager-contract.ts:");
  console.log(`      ${chainId}: '${address}',\n`);
  console.log("📌 Verify the source so payers can check what they approve:");
  console.log(`      npx hardhat verify --network ${network.name} ${address} ${owner}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌", error.message);
    process.exit(1);
  });
