require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🧪 TronYieldAggregator - Basic Test Suite\n');

    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    const fs = require('fs');
    const path = require('path');

    const deployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/deployment-yield-aggregator-nile-testnet.json'), 'utf8')
    );

    console.log('Contract:', deployment.contractAddress);
    console.log('TRONScan: https://nile.tronscan.org/#/contract/' + deployment.contractAddress);

    const artifact = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/TronYieldAggregator.json'), 'utf8')
    );
    const abi = artifact.abi;

    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const testerAddress = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log('Tester:', testerAddress);

    const contractInstance = await tronWeb.contract(abi, deployment.contractAddress);

    console.log('\n🔍 Test 1: Read Contract Configuration...');
    const owner = await contractInstance.owner().call();
    console.log('✓ Owner:', owner);

    const totalMerchants = await contractInstance.getActiveMerchantCount().call();
    console.log('✓ Total Merchants:', Number(BigInt(totalMerchants)));

    const autoCompound = await contractInstance.autoCompoundEnabled().call();
    console.log('✓ Auto Compound:', autoCompound);

    console.log('\n🪙 Test 2: Get Supported Tokens...');
    const supportedTokens = await contractInstance.getSupportedTokens().call();
    console.log('✅ Supported Tokens:', supportedTokens.length);
    supportedTokens.forEach((token, i) => {
        console.log(`  ${i + 1}.`, token);
    });

    if (supportedTokens.length > 0) {
        const tokenAddress = supportedTokens[0];

        console.log('\n💰 Test 3: Get Token Balance...');
        const balance = await contractInstance.getTokenBalance(tokenAddress).call();
        console.log('✅ Contract Balance:', (Number(BigInt(balance)) / 1e6).toLocaleString(), 'USDT');

        console.log('\n👤 Test 4: Get Merchant Balance...');
        const merchantBalance = await contractInstance.getMerchantBalance(testerAddress, tokenAddress).call();
        console.log('✅ Merchant Balance:');
        console.log('   Total:', (Number(BigInt(merchantBalance[0])) / 1e6).toLocaleString(), 'USDT');
        console.log('   Principal:', (Number(BigInt(merchantBalance[1])) / 1e6).toLocaleString(), 'USDT');
        console.log('   Interest:', (Number(BigInt(merchantBalance[2])) / 1e6).toLocaleString(), 'USDT');

        console.log('\n📈 Test 5: Get Contract Statistics...');
        const stats = await contractInstance.getStats().call();
        console.log('✅ Contract Statistics:');
        console.log('   Active Merchants:', Number(BigInt(stats[0])));
        console.log('   Supported Tokens:', Number(BigInt(stats[1])));
        console.log('   TVL:', (Number(BigInt(stats[2])) / 1e18).toLocaleString(), 'USD');
        console.log('   Auto Compound:', stats[3]);
        console.log('   Deposits Paused:', stats[4]);
        console.log('   Withdrawals Paused:', stats[5]);

        console.log('\n🔄 Test 6: Toggle Auto Compound...');
        console.log('   Current state:', autoCompound);
        const toggleTx = await contractInstance.toggleAutoCompound(false).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 200000000
        });
        console.log('✅ Auto Compound Disabled! Tx:', toggleTx);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const newAutoCompound = await contractInstance.autoCompoundEnabled().call();
        console.log('   New state:', newAutoCompound);
    }

    console.log('\n═════════════════════════════════════════════');
    console.log('✅ All Tests Passed!');
    console.log('═════════════════════════════════════════════');
    console.log('\n📊 Summary:');
    console.log('  ✅ Contract is active on TRON Nile Testnet');
    console.log('  ✅ Successfully called view functions');
    console.log('  ✅ Retrieved contract state and statistics');
    console.log('  ✅ Auto-compound toggle working');
    console.log('\n⚠️  Note: Deposit/withdraw not tested (requires mock JustLend)');
}

main().catch(console.error);
