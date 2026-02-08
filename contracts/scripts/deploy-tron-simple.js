/**
 * Simple deployment script for TronPaymentVault to TRON Nile Testnet
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🚀 Deploying TronPaymentVault to TRON Nile Testnet...\n');

    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        console.error('❌ Error: DEPLOYER_PRIVATE_KEY not found');
        console.log('💡 Create a .env file with: DEPLOYER_PRIVATE_KEY=your_private_key_hex');
        process.exit(1);
    }

    // Initialize TronWeb
    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const deployerAddress = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log(`📝 Deployer Address: ${deployerAddress}\n`);

    // Load contract artifacts
    const fs = require('fs');
    const path = require('path');
    const artifact = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/TronPaymentVault.json'), 'utf8')
    );
    const abi = artifact.abi;
    const bytecode = artifact.bytecode;

    // Constructor parameters
    // For testing, we use unique addresses for signers
    // Since we only have one test address, we'll set threshold to 1
    const initialSigners = [
        deployerAddress  // Single signer for testing
    ];
    const threshold = 1;  // Single-signer for testing
    const guardian = deployerAddress;
    const supportedTokens = [
        'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'  // USDT (may not exist on testnet)
    ];
    const timelock = 86400;
    const dailyLimit = '1000000000000';

    console.log('📋 Deployment Parameters:');
    console.log(`  Signers: ${initialSigners.length}`);
    console.log(`  Threshold: ${threshold}/${initialSigners.length}`);
    console.log(`  Guardian: ${guardian}`);
    console.log(`  Timelock: ${timelock}s (${timelock/3600}h)\n`);

    console.log('📦 Deploying contract...\n');

    try {
        // Method 1: Using TronWeb.TransactionBuilder for deployment
        // Increase feeLimit to ensure successful deployment with TRX instead of Energy
        const transaction = await tronWeb.transactionBuilder.createSmartContract({
            abi: JSON.stringify(abi),
            bytecode: bytecode,
            parameters: [
                initialSigners,
                threshold,
                guardian,
                supportedTokens,
                timelock,
                dailyLimit
            ],
            feeLimit: 1000000000,  // 1000 TRX - will use TRX to burn for Energy
            callValue: 0,
            userFeePercentage: 100
        }, deployerAddress);

        const signedTx = await tronWeb.trx.sign(transaction);
        console.log('📤 Sending deployment transaction...');
        const result = await tronWeb.trx.sendRawTransaction(signedTx);

        if (result.result) {
            // Wait for transaction confirmation
            console.log('⏳ Waiting for transaction confirmation...');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Get confirmed transaction to get contract address
            const tx = await tronWeb.trx.getTransaction(result.txid);
            let contractAddress = null;

            if (tx && tx.contract_address) {
                contractAddress = tronWeb.address.fromHex(tx.contract_address);
            } else if (tx && tx.raw_data && tx.raw_data.contract && tx.raw_data.contract[0]) {
                const contractAddressHex = tx.raw_data.contract[0].parameter.value.contract_address;
                if (contractAddressHex) {
                    contractAddress = tronWeb.address.fromHex(contractAddressHex);
                }
            }

            if (!contractAddress) {
                console.error('❌ Could not extract contract address from transaction');
                console.error('Transaction data:', JSON.stringify(tx, null, 2));
                process.exit(1);
            }

            console.log('✅ Contract deployed successfully!');
            console.log(`\n📍 Contract Address: ${contractAddress}`);
            console.log(`🔗 View on TRONScan: https://nile.tronscan.org/#/contract/${contractAddress}`);
            console.log(`🔗 Transaction: https://nile.tronscan.org/#/transaction/${result.txid}\n`);

            // Save deployment info
            const deploymentInfo = {
                network: 'TRON Nile Testnet',
                contractAddress,
                deployer: deployerAddress,
                transactionHash: result.txid,
                timestamp: new Date().toISOString(),
                config: { initialSigners, threshold, guardian, supportedTokens, timelock, dailyLimit }
            };
            fs.writeFileSync(
                path.join(__dirname, '../artifacts/tron/deployment-nile-testnet.json'),
                JSON.stringify(deploymentInfo, null, 2)
            );
            console.log('📄 Deployment saved to: artifacts/tron/deployment-nile-testnet.json\n');

        } else {
            console.error('❌ Deployment failed!');
            console.error('Result:', result);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Deployment error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

main().catch(console.error);
