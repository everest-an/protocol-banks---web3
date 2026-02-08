require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🧪 TronYieldAggregator - Basic Test\n');

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

    console.log('\n🔍 Testing Contract Functions:\n');

    try {
        const owner = await contractInstance.owner().call();
        console.log('✅ owner():', owner);
    } catch (e) { }

    try {
        const merchants = await contractInstance.getActiveMerchantCount().call();
        console.log('✅ getActiveMerchantCount():', Number(BigInt(merchants)));
    } catch (e) { }

    try {
        const tokens = await contractInstance.getSupportedTokens().call();
        console.log('✅ getSupportedTokens():', tokens.length, 'tokens');
    } catch (e) { }

    try {
        const autoCompound = await contractInstance.autoCompoundEnabled().call();
        console.log('✅ autoCompoundEnabled():', autoCompound);
    } catch (e) { }

    try {
        const depositPaused = await contractInstance.depositPaused().call();
        console.log('✅ depositPaused():', depositPaused);
    } catch (e) { }

    try {
        const withdrawalPaused = await contractInstance.withdrawalPaused().call();
        console.log('✅ withdrawalPaused():', withdrawalPaused);
    } catch (e) { }

    console.log('\n🔄 Testing Owner Functions:\n');

    try {
        console.log('Toggle autoCompound(false)...');
        const tx = await contractInstance.toggleAutoCompound(false).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 100000000
        });
        console.log('✅ Tx:', tx);
    } catch (e) { console.error('❌', e.message); }

    console.log('\n📊 Contract Statistics:\n');

    try {
        const stats = await contractInstance.getStats().call();
        console.log('✅ getStats():');
        console.log('   Active Merchants:', Number(BigInt(stats[0])));
        console.log('   Supported Tokens:', Number(BigInt(stats[1])));
        console.log('   TVL:', (Number(BigInt(stats[2])) / 1e18).toLocaleString(), 'USD');
        console.log('   Auto Compound:', stats[3]);
        console.log('   Deposits Paused:', stats[4]);
        console.log('   Withdrawals Paused:', stats[5]);
    } catch (e) { console.error('❌', e.message); }

    console.log('\n══════════════════════════════════════════════════');
    console.log('✅ TronYieldAggregator Test Complete!');
    console.log('══════════════════════════════════════════════════');
}

main().catch(console.error);
