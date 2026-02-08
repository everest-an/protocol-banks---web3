/**
 * Deploy TronPaymentVault to TRON Nile Testnet
 *
 * Prerequisites:
 * 1. Get testnet TRX from: https://nileex.io/join/getJoinPage
 * 2. Set DEPLOYER_PRIVATE_KEY in .env file or environment variable
 * 3. Use Base58 address format (T-prefix)
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🚀 Deploying TronPaymentVault to TRON Nile Testnet...\n');

    // Check for required environment variables
    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        console.error('❌ Error: DEPLOYER_PRIVATE_KEY not found in environment variables');
        console.log('💡 Create a .env file with: DEPLOYER_PRIVATE_KEY=your_private_key_hex');
        process.exit(1);
    }

    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    // Set private key
    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);

    // Get deployer address
    const deployerAddress = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log(`📝 Deployer Address: ${deployerAddress}`);

    // Get balance
    try {
        const balance = await tronWeb.trx.getBalance(deployerAddress);
        const balanceTrx = tronWeb.fromSun(balance);
        console.log(`💰 Deployer Balance: ${balanceTrx} TRX\n`);

        if (parseFloat(balanceTrx) < 100) {
            console.warn('⚠️  Warning: Balance is low. Get testnet TRX from: https://nileex.io/join/getJoinPage\n');
        }
    } catch (error) {
        console.warn('⚠️  Could not check balance:', error.message, '\n');
    }

    // Load contract artifacts
    const fs = require('fs');
    const path = require('path');
    const artifactPath = path.join(__dirname, '../artifacts/tron/TronPaymentVault.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;
    const bytecode = artifact.bytecode;

    // Deployment parameters
    // NOTE: Use Base58 address format for TRON (T-prefix addresses)
    const initialSigners = [
        'TYourSigner1AddressHere', // Replace with actual signer address
        'TYourSigner2AddressHere', // Replace with actual signer address
        'TYourSigner3AddressHere'  // Replace with actual signer address
    ];

    const threshold = 2; // Require 2 of 3 signatures
    const guardian = deployerAddress; // Use deployer as guardian
    const supportedTokens = [
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' // USDT on Nile Testnet (or use mock address)
    ];
    const timelock = 86400; // 24 hours in seconds
    const dailyLimit = '1000000000000'; // 1,000,000 USDT (6 decimals)

    console.log('═════════════════════════════════════════════════════════');
    console.log('📋 Deployment Parameters:');
    console.log('═════════════════════════════════════════════════════════');
    console.log(`Initial Signers: ${initialSigners.length}`);
    initialSigners.forEach((signer, i) => {
        console.log(`  ${i + 1}. ${signer}`);
    });
    console.log(`Threshold: ${threshold} of ${initialSigners.length} signatures`);
    console.log(`Guardian: ${guardian}`);
    console.log(`Supported Tokens: ${supportedTokens.length}`);
    supportedTokens.forEach((token, i) => {
        console.log(`  ${i + 1}. ${token}`);
    });
    console.log(`Timelock: ${timelock} seconds (${timelock / 3600} hours)`);
    console.log(`Daily Limit: ${(parseInt(dailyLimit) / 1e6).toLocaleString()} USDT`);
    console.log('═════════════════════════════════════════════════════════\n');

    console.log('📦 Deploying contract...');
    console.log('   This may take 1-2 minutes...\n');

    try {
        // Encode constructor parameters
        const tronWebInstance = new TronWeb({
            fullNode: 'https://nile.trongrid.io',
            solidityNode: 'https://nile.trongrid.io',
            eventServer: 'https://nile.trongrid.io'
        });

        // Create contract instance with deployed constructor
        const contract = await tronWebInstance.contract().new({
            abi: abi,
            bytecode: bytecode,
            from: deployerAddress,
            parameters: [
                initialSigners,
                threshold,
                guardian,
                supportedTokens,
                timelock,
                dailyLimit
            ]
        });

        const contractAddress = contract.address;
        console.log('✅ Contract deployed successfully!');
        console.log(`\n📍 Contract Address: ${contractAddress}`);

        // Create deployment summary
        const deploymentSummary = {
            network: 'TRON Nile Testnet',
            fullNode: 'https://nile.trongrid.io',
            contractAddress: contractAddress,
            deployer: deployerAddress,
            timestamp: new Date().toISOString(),
            parameters: {
                initialSigners,
                threshold,
                guardian,
                supportedTokens,
                timelock,
                dailyLimit
            }
        };

        const summaryPath = path.join(__dirname, '../artifacts/tron/deployment-nile-testnet.json');
        fs.writeFileSync(summaryPath, JSON.stringify(deploymentSummary, null, 2));
        console.log(`\n📄 Deployment summary saved to: ${summaryPath}`);

        console.log('\n═════════════════════════════════════════════════════════');
        console.log('✅ Deployment Complete!');
        console.log('═════════════════════════════════════════════════════════');
        console.log('\n📝 Next Steps:');
        console.log('1. Fund the vault with USDT');
        console.log('2. Run test script: node scripts/test-vault.js');
        console.log('3. Verify contract on TRONScan: https://nile.tronscan.org/');
        console.log('\n⚠️  Important:');
        console.log('- Update signers in deployment script before deploying');
        console.log('- Never commit your private key');
        console.log('- Test thoroughly on Nile testnet before mainnet deployment');
        console.log('═════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Deployment failed!');
        console.error('Error:', error.message);

        if (error.message.includes('Balance is not sufficient')) {
            console.error('\n💡 Get testnet TRX from: https://nileex.io/join/getJoinPage');
        }

        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { main };
