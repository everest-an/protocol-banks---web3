import { ethers, network } from "hardhat";

/**
 * Add a token to a deployed SubscriptionManager's allowlist.
 *
 * Until a token is allowlisted, every createSubscription call for it reverts
 * with TokenNotAllowed. Only standard ERC-20s belong here: fee-on-transfer and
 * rebasing tokens deliver less than `amountPerPeriod`, which the contract has no
 * way to detect, so the merchant would be shorted while events report the full
 * amount.
 *
 * Usage:
 *   MANAGER_ADDRESS=0x... TOKEN=0x... \
 *     npx hardhat run scripts/allowlist-token.ts --network arbitrum
 */
async function main() {
  const managerAddress = process.env.MANAGER_ADDRESS;
  const token = process.env.TOKEN;

  if (!managerAddress) throw new Error("Set MANAGER_ADDRESS");
  if (!token) throw new Error("Set TOKEN to the ERC-20 address to allow");

  const [signer] = await ethers.getSigners();
  const manager = await ethers.getContractAt("SubscriptionManager", managerAddress);

  const owner = await manager.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Only the owner can change the allowlist. Owner is ${owner}, signer is ${signer.address}.`
    );
  }

  if (await manager.allowedTokens(token)) {
    console.log(`✅ ${token} is already allowlisted — nothing to do.`);
    return;
  }

  // Sanity-check the target actually looks like an ERC-20 with permit, since a
  // wrong address here silently produces subscriptions that can never charge.
  const erc20 = await ethers.getContractAt(
    [
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function nonces(address) view returns (uint256)",
    ],
    token
  );

  let symbol = "?";
  try {
    symbol = await erc20.symbol();
    const decimals = await erc20.decimals();
    console.log(`   Token: ${symbol} (${decimals} decimals)`);
  } catch {
    throw new Error(`${token} does not look like an ERC-20 on ${network.name}`);
  }

  try {
    await erc20.nonces(signer.address);
    console.log("   EIP-2612 permit: supported");
  } catch {
    console.log("   ⚠️  EIP-2612 permit: NOT supported — single-transaction setup");
    console.log("      (createSubscriptionWithPermit) will revert for this token.");
    console.log("      Payers must approve() first, then createSubscription().");
  }

  const tx = await manager.setTokenAllowed(token, true);
  console.log(`\n   Submitting… ${tx.hash}`);
  await tx.wait();

  const confirmed = await manager.allowedTokens(token);
  if (!confirmed) throw new Error("Transaction mined but the token is still not allowed");

  console.log(`\n✅ ${symbol} (${token}) allowlisted on ${network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌", error.message);
    process.exit(1);
  });
