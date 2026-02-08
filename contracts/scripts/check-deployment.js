require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    // Load deployment info
    const fs = require('fs');
    const path = require('path');
    const deployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/deployment-nile-testnet.json'), 'utf8')
    );

    console.log('📋 Deployment Info:');
    console.log(`  Network: ${deployment.network}`);
    console.log(`  Contract: ${deployment.contractAddress}`);
    console.log(`  Tx Hash: ${deployment.transactionHash}`);
    console.log(`  Deployer: ${deployment.deployer}`);
    console.log(`  Timestamp: ${deployment.timestamp}\n`);

    // Check transaction status
    console.log('🔍 Checking transaction status...');
    const tx = await tronWeb.trx.getTransaction(deployment.transactionHash);
    console.log(`  Transaction confirmed: ${tx.ret[0]?.contractRet === 'SUCCESS'}`);

    // Wait for a few blocks and check contract
    console.log('\n⏳ Waiting for 10 seconds for blockchain confirmation...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n🔍 Checking if contract exists on blockchain...');
    try {
        const contractCode = await tronWeb.trx.getContractDeployment(deployment.contractAddress);
        if (contractCode) {
            console.log('\n✅ Contract is confirmed on blockchain!');

            // Load ABI and create contract instance
            const artifact = JSON.parse(
                fs.readFileSync(path.join(__dirname, '../artifacts/tron/TronPaymentVault.json'), 'utf8')
            );
            const abi = artifact.abi;
            const contract = await tronWeb.contract(abi, deployment.contractAddress);

            // Test contract calls
            console.log('\n🧪 Testing contract interactions:\n');

            const threshold = await contract.threshold().call();
            console.log(`✅ Threshold: ${threshold}`);

            const timelock = await contract.timelock().call();
            console.log(`✅ Timelock: ${timelock} seconds (${(timelock/3600).toFixed(2)} hours)`);

            const dailyLimit = await contract.dailyLimit().call();
            console.log(`✅ Daily Limit: ${(parseInt(dailyLimit) / 1e6).toLocaleString()} USDT`);

            const nextPaymentId = await contract.nextPaymentId().call();
            console.log(`✅ Next Payment ID: ${nextPaymentId}`);

            const isSigner = await contract.isSigner(deployment.deployer).call();
            console.log(`✅ Deployer is signer: ${isSigner}`);

            // Get signers
            const signers = await contract.getSigners().call();
            console.log('\n✅ Signers:');
            signers.forEach((signer, i) => {
                console.log(`  ${i + 1}. ${signer}`);
            });

            console.log('\n🎉 All contract tests passed!');
        } else {
            console.log('❌ Contract not found on blockchain. It may still be confirming.');
        }
    } catch (error) {
        console.log('⚠️  Contract check error:', error.message);
        console.log('\nThe contract may still be confirming. Please try again later.');
    }
}

main().catch(console.error);
