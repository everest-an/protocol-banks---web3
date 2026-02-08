require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🧪 Simple Test - TronPaymentSplitter\n');

    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    const fs = require('fs');
    const path = require('path');

    // Load deployment info
    const deployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/deployment-splitter-nile-testnet.json'), 'utf8')
    );

    console.log('Contract:', deployment.contractAddress);

    // Load ABI
    const artifact = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/TronPaymentSplitter.json'), 'utf8')
    );
    const abi = artifact.abi;

    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const testerAddress = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log('Tester:', testerAddress);

    const contractInstance = await tronWeb.contract(abi, deployment.contractAddress);

    console.log('\n🔍 Test 1: Checking if token is supported...');
    const testTokenAddress = deployment.config.supportedTokens[0];
    const isSupported = await contractInstance.isTokenSupported(testTokenAddress).call();
    console.log(`Token ${testTokenAddress} supported: ${isSupported}`);

    if (!isSupported) {
        console.log('\n⚠️  Token not supported! Let me check the contract state...');

        // Try to add the token
        console.log('⏳ Adding token to supported list...');
        try {
            const addTx = await contractInstance.addSupportedToken(testTokenAddress).send({
                from: testerAddress,
                shouldPollResponse: true,
                feeLimit: 100000000
            });
            console.log('✅ Token added! Tx:', addTx);
        } catch (addError) {
            console.error('❌ Could not add token:', addError.message);
            console.log('\nMaybe the token was already added. Trying split creation...');
        }
    }

    console.log('\n💸 Test 2: Creating simple split with 1 beneficiary...');

    // Create split with single beneficiary
    const beneficiaries = [
        [testerAddress, 10000, 0, 0]  // 100% to tester
    ];

    try {
        const createTx = await contractInstance.createSplit(
            testTokenAddress,
            0, // Percentage mode
            '1000000', // Min 1 USDT
            beneficiaries
        ).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 200000000
        });

        console.log('✅ Split created! Tx:', createTx);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const nextId = await contractInstance.nextSplitId().call();
        const splitId = Number(BigInt(nextId)) - 1;
        console.log('Split ID:', splitId);

        console.log('\n📋 Getting split details...');
        const split = await contractInstance.splits(splitId).call();
        console.log('Token:', split.token);
        console.log('Mode:', split.mode);
        console.log('Min Amount:', split.minAmount);
        console.log('Beneficiaries:', split.beneficiaryCount);

        console.log('\n👥 Getting beneficiaries...');
        const benefs = await contractInstance.getBeneficiaries(splitId).call();
        benefs.forEach((b, i) => {
            console.log(`  ${i + 1}. ${b.account} - ${Number(BigInt(b.percentage)) / 100}%`);
        });

        console.log('\n🎉 Test passed!');
    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        if (error.error) {
            console.error('Details:', error.error);
        }
    }
}

main().catch(console.error);
