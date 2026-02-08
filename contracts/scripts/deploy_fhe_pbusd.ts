import { ethers, network } from "hardhat";

/**
 * Deploy Script for Confidential Protocol Bank USD (cPBUSD)
 *
 * This script deploys the FHE-enabled versions of the contracts.
 * If deploying to a network without native FHE support (like standard HashKey Testnet),
 * it will automatically deploy a MockFHE coprocessor to simulate encryption.
 *
 * Networks:
 *   - HashKey Testnet/Mainnet
 *   - Localhost
 *
 * Usage:
 *   npx hardhat run scripts/deploy_fhe_pbusd.ts --network <network>
 */

// ══════════════════════════════════════════════════════════════════
//                     CONFIGURATION
// ══════════════════════════════════════════════════════════════════

interface FHEConfig {
    coprocessor?: string; // Address of real FHE coprocessor (optional)
    acl?: string;         // Address of FHE ACL (optional)
    dailyMintCap: bigint;
}

const CONFIG: Record<string, FHEConfig> = {
    // HashKey Testnet Configuration
    hashkeyTestnet: {
        // If Zama is not natively integrated, leave coprocessor undefined to deploy MockFHE
        dailyMintCap: ethers.parseUnits("1000000", 6), // 1M cPBUSD
    },
    // HashKey Mainnet Configuration
    hashkey: {
        dailyMintCap: ethers.parseUnits("5000000", 6), // 5M cPBUSD
    },
    // Localhost / Hardhat Network
    localhost: {
        dailyMintCap: ethers.parseUnits("10000000", 6),
    },
    hardhat: {
        dailyMintCap: ethers.parseUnits("10000000", 6),
    },
};

async function main() {
    const [deployer] = await ethers.getSigners();
    const networkName = network.name;
    const config = CONFIG[networkName] || CONFIG.localhost;

    console.log(`\n🚀 Starting FHE Deployment on network: ${networkName}`);
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Balance:  ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

    // ══════════════════════════════════════════════════════════════════
    //      1. Setup FHE Environment (Mock vs Real)
    // ══════════════════════════════════════════════════════════════════
    let coprocessorAddress = config.coprocessor;
    let aclAddress = config.acl;

    if (!coprocessorAddress) {
        console.log("\n⚠️  No FHE Coprocessor configured. Deploying MockFHE...");
        const MockFHE = await ethers.getContractFactory("MockFHE");
        const mockFHE = await MockFHE.deploy();
        await mockFHE.waitForDeployment();
        coprocessorAddress = await mockFHE.getAddress();
        // For MockFHE, ACL is handled internally or same address, but we can pass MockFHE as ACL purely for interface compliance if needed
        aclAddress = coprocessorAddress; 
        console.log(`   ✅ MockFHE deployed: ${coprocessorAddress}`);
    } else {
        console.log(`\n🔒 Using existing FHE Coprocessor: ${coprocessorAddress}`);
    }

    if (!aclAddress) {
         aclAddress = coprocessorAddress; // Fallback
    }

    // ══════════════════════════════════════════════════════════════════
    //      2. Deploy ConfidentialPBUSD
    // ══════════════════════════════════════════════════════════════════
    console.log("\n🪙 Deploying ConfidentialPBUSD...");
    const ConfidentialPBUSD = await ethers.getContractFactory("ConfidentialPBUSD");
    
    // Args: admin, minter, pauser, compliance, dailyMintCap, coprocessor, acl
    const cPBUSD = await ConfidentialPBUSD.deploy(
        deployer.address, // Admin
        deployer.address, // Minter (Bridge Bot - transfer later)
        deployer.address, // Pauser
        deployer.address, // Compliance
        config.dailyMintCap,
        coprocessorAddress,
        aclAddress
    );
    await cPBUSD.waitForDeployment();
    const cPBUSDAddr = await cPBUSD.getAddress();
    console.log(`   ✅ ConfidentialPBUSD deployed: ${cPBUSDAddr}`);

    // ══════════════════════════════════════════════════════════════════
    //      3. Post-Deployment Info
    // ══════════════════════════════════════════════════════════════════
    console.log("\n📜 Deployment Summary:");
    console.log("----------------------------------------------------");
    console.log(` Network:        ${networkName}`);
    console.log(` Coprocessor:    ${coprocessorAddress} ${!config.coprocessor ? '(Mock)' : '(Real)'}`);
    console.log(` cPBUSD:         ${cPBUSDAddr}`);
    console.log("----------------------------------------------------");
    console.log("\n👉 Next Steps:");
    console.log("   1. Verify contract on block explorer");
    console.log("   2. Grant MINTER_ROLE to the FHE Bridge Bot");
    console.log("   3. Update frontend config with new cPBUSD address");

    // Optional: Verify if on a real network
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("\nℹ️  To verify on Etherscan/Blockscout:");
        console.log(`   npx hardhat verify --network ${networkName} ${cPBUSDAddr} ${deployer.address} ${deployer.address} ${deployer.address} ${deployer.address} ${config.dailyMintCap} ${coprocessorAddress} ${aclAddress}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
