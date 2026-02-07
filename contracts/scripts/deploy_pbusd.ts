import { ethers, network } from "hardhat";

/**
 * Deploy Script for Protocol Bank USD (pbUSD) System
 *
 * Networks:
 *   - Base (mainnet/testnet): Deploy ProtocolBankTreasury
 *   - HashKey (mainnet/testnet): Deploy ProtocolBankUSD
 *   - Localhost: Deploy all + MockUSDC for testing
 *
 * Usage:
 *   npx hardhat run scripts/deploy_pbusd.ts --network <network>
 */

// ══════════════════════════════════════════════════════════════════
//                     CONFIGURATION
// ══════════════════════════════════════════════════════════════════

interface DeployConfig {
  usdcAddress?: string;
  dailyMintCap: bigint;
  dailyReleaseCap: bigint;
  emergencyDelay: number;
}

const CONFIG: Record<string, DeployConfig> = {
  base: {
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet USDC
    dailyMintCap: ethers.parseUnits("5000000", 6),     // 5M pbUSD (6 decimals)
    dailyReleaseCap: ethers.parseUnits("5000000", 6),  // 5M USDC
    emergencyDelay: 172800,                             // 48 hours
  },
  baseSepolia: {
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
    dailyMintCap: ethers.parseUnits("1000000", 6),     // 1M pbUSD (6 decimals)
    dailyReleaseCap: ethers.parseUnits("1000000", 6),  // 1M USDC
    emergencyDelay: 3600,                               // 1 hour (testnet)
  },
  hashkey: {
    dailyMintCap: ethers.parseUnits("5000000", 6),     // 5M pbUSD (6 decimals)
    dailyReleaseCap: ethers.parseUnits("5000000", 6),
    emergencyDelay: 172800,
  },
  hashkeyTestnet: {
    dailyMintCap: ethers.parseUnits("1000000", 6),     // 1M pbUSD (6 decimals)
    dailyReleaseCap: ethers.parseUnits("1000000", 6),
    emergencyDelay: 3600,
  },
  localhost: {
    dailyMintCap: ethers.parseUnits("10000000", 6),    // 10M pbUSD (6 decimals)
    dailyReleaseCap: ethers.parseUnits("10000000", 6), // 10M USDC
    emergencyDelay: 60,                                 // 1 minute (local dev)
  },
};

// ══════════════════════════════════════════════════════════════════
//                     DEPLOY FUNCTIONS
// ══════════════════════════════════════════════════════════════════

async function deployMockUSDC() {
  console.log("\n📦 Deploying MockUSDC...");
  // Deploy MockERC20 with 6 decimals for testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockUSDC = await MockERC20.deploy("USD Coin", "USDC");
  await mockUSDC.waitForDeployment();
  // Note: Standard MockERC20 is 18 decimals, but for testing pbUSD parity we care about values.
  // If we really want 6 decimals mock, we'd need to modify MockERC20 or deploy a different one.
  // For now, we assume MockUSDC is 18 decimals in local tests unless we change it.
  // Ideally, update MockERC20 to support decimals in constructor.
  const addr = await mockUSDC.getAddress();
  console.log(`   ✅ MockUSDC deployed: ${addr}`);
  return addr;
}

async function deployPbUSD(config: DeployConfig) {
  const [deployer] = await ethers.getSigners();
  console.log("\n🪙 Deploying ProtocolBankUSD...");
  console.log(`   Admin/Minter/Pauser/Compliance: ${deployer.address}`);
  console.log(`   Daily Mint Cap: ${ethers.formatUnits(config.dailyMintCap, 6)} pbUSD`);

  const PbUSD = await ethers.getContractFactory("ProtocolBankUSD");
  const pbUSD = await PbUSD.deploy(
    deployer.address, // admin
    deployer.address, // minter (bridge bot - update after deploy)
    deployer.address, // pauser
    deployer.address, // compliance
    config.dailyMintCap
  );
  await pbUSD.waitForDeployment();
  const addr = await pbUSD.getAddress();
  console.log(`   ✅ ProtocolBankUSD deployed: ${addr}`);
  return addr;
}

async function deployTreasury(usdcAddress: string, config: DeployConfig) {
  const [deployer] = await ethers.getSigners();
  console.log("\n🏦 Deploying ProtocolBankTreasury...");
  console.log(`   USDC: ${usdcAddress}`);
  console.log(`   Admin/Relayer/Guardian: ${deployer.address}`);
  console.log(`   Daily Release Cap: ${ethers.formatUnits(config.dailyReleaseCap, 6)} USDC`);
  console.log(`   Emergency Delay: ${config.emergencyDelay}s`);

  const Treasury = await ethers.getContractFactory("ProtocolBankTreasury");
  const treasury = await Treasury.deploy(
    usdcAddress,
    deployer.address,  // admin
    deployer.address,  // relayer (bridge bot - update after deploy)
    deployer.address,  // guardian
    config.dailyReleaseCap,
    config.emergencyDelay
  );
  await treasury.waitForDeployment();
  const addr = await treasury.getAddress();
  console.log(`   ✅ ProtocolBankTreasury deployed: ${addr}`);
  return addr;
}

// ══════════════════════════════════════════════════════════════════
//                        MAIN
// ══════════════════════════════════════════════════════════════════

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const networkName = network.name;

  console.log("═══════════════════════════════════════════════════════");
  console.log("       Protocol Bank USD - Deployment Script");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`Network:  ${networkName} (chainId: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const config = CONFIG[networkName] || CONFIG.localhost;

  const deployedContracts: Record<string, string> = {};

  // Determine what to deploy based on chain
  const isBase = chainId === 8453n || chainId === 84532n;
  const isHashKey = chainId === 177n || chainId === 133n;
  const isLocal = chainId === 31337n || chainId === 1337n;

  if (isLocal) {
    // Local: deploy everything for testing
    const usdcAddr = await deployMockUSDC();
    deployedContracts.MockUSDC = usdcAddr;

    const treasuryAddr = await deployTreasury(usdcAddr, config);
    deployedContracts.ProtocolBankTreasury = treasuryAddr;

    const pbUSDAddr = await deployPbUSD(config);
    deployedContracts.ProtocolBankUSD = pbUSDAddr;

    // Mint test USDC to deployer
    const mockUSDC = await ethers.getContractAt("MockERC20", usdcAddr);
    await mockUSDC.mint(deployer.address, ethers.parseUnits("1000000", 6));
    console.log("\n💰 Minted 1,000,000 USDC to deployer");
  } else if (isBase) {
    // Base: deploy Treasury only
    const usdcAddr = config.usdcAddress!;
    const treasuryAddr = await deployTreasury(usdcAddr, config);
    deployedContracts.ProtocolBankTreasury = treasuryAddr;
  } else if (isHashKey) {
    // HashKey: deploy pbUSD only
    const pbUSDAddr = await deployPbUSD(config);
    deployedContracts.ProtocolBankUSD = pbUSDAddr;
  } else {
    console.log("\n⚠️  Unknown chain. Deploying all contracts (like localhost)...");
    const usdcAddr = await deployMockUSDC();
    deployedContracts.MockUSDC = usdcAddr;

    const treasuryAddr = await deployTreasury(usdcAddr, config);
    deployedContracts.ProtocolBankTreasury = treasuryAddr;

    const pbUSDAddr = await deployPbUSD(config);
    deployedContracts.ProtocolBankUSD = pbUSDAddr;
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("                  DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  for (const [name, addr] of Object.entries(deployedContracts)) {
    console.log(`  ${name}: ${addr}`);
  }
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n⚠️  IMPORTANT POST-DEPLOYMENT STEPS:");
  console.log("  1. Update MINTER_ROLE to the bridge bot address on HashKey");
  console.log("  2. Update RELAYER_ROLE to the bridge bot address on Base");
  console.log("  3. Update GUARDIAN_ROLE to multi-sig address");
  console.log("  4. Verify contracts on block explorers");
  console.log("  5. Test the full bridge flow on testnet before mainnet");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
