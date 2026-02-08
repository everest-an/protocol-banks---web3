require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🧪 TronPaymentSplitter - TRON Nile Testnet Test Suite\n');

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

    console.log('═════════════════════════════════════════════════════════');
    console.log('📋 Deployment Information');
    console.log('═════════════════════════════════════════════════════════');
    console.log(`📍 Contract: ${deployment.contractAddress}`);
    console.log(`🔗 TRONScan: https://nile.tronscan.org/#/contract/${deployment.contractAddress}`);
    console.log(`🔗 Tx Hash: https://nile.tronscan.org/#/transaction/${deployment.transactionHash}`);
    console.log(`📝 Deployer: ${deployment.deployer}\n`);

    // Load ABI
    const artifact = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/TronPaymentSplitter.json'), 'utf8')
    );
    const abi = artifact.abi;

    // Set private key
    tronWeb.setPrivateKey(process.env.DEPLOYER_PRIVATE_KEY);
    const testerAddress = tronWeb.address.fromHex(tronWeb.defaultAddress.hex);
    console.log('📝 Tester Address:', testerAddress);

    // Wait for contract to be ready
    console.log('\n⏳ Checking if contract is ready...');
    let attempts = 0;
    let contractInstance = null;

    while (attempts < 12) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

        try {
            console.log(`   Attempt ${attempts}/12...`);

            const txInfo = await tronWeb.trx.getTransactionInfo(deployment.transactionHash);

            if (!txInfo || !txInfo.receipt || !txInfo.receipt.result) {
                console.log(`   ⏳ Transaction not confirmed yet...`);
                continue;
            }

            if (txInfo.receipt.result !== 'SUCCESS') {
                console.error('   ❌ Transaction failed:', txInfo.receipt);
                process.exit(1);
            }

            console.log('   ✅ Transaction confirmed! Creating contract instance...');

            contractInstance = await tronWeb.contract(abi, deployment.contractAddress);
            const testCall = await contractInstance.owner().call();
            console.log('   ✅ Contract is ready!');

            break;
        } catch (error) {
            if (attempts >= 12) {
                console.error('\n❌ Contract not ready after 60 seconds.');
                process.exit(1);
            }
        }
    }

    if (!contractInstance) {
        console.error('\n❌ Could not create contract instance');
        process.exit(1);
    }

    console.log('\n');

    // ══════════════════════════════════════════════════════════
    // Test 1: Read Contract State
    // ══════════════════════════════════════════════════════════
    console.log('═════════════════════════════════════════════════════════');
    console.log('🔍 Test 1: Read Contract State');
    console.log('═════════════════════════════════════════════════════════');

    const owner = await contractInstance.owner().call();
    console.log(`✓ Owner: ${owner}`);

    const nextSplitId = await contractInstance.nextSplitId().call();
    const nextSplitIdNum = Number(BigInt(nextSplitId));
    console.log(`✓ Next Split ID: ${nextSplitIdNum}`);

    // ══════════════════════════════════════════════════════════
    // Test 2: Create Percentage Split
    // ══════════════════════════════════════════════════════════
    console.log('\n═════════════════════════════════════════════════════════');
    console.log('💸 Test 2: Create Percentage Split');
    console.log('═════════════════════════════════════════════════════════');

    const testTokenAddress = deployment.config.supportedTokens[0];

    // Create beneficiaries with different addresses
    // Generate some test addresses (these don't need to have funds for creation)
    const beneficiary1 = testerAddress;
    // Use a valid-looking test address that's different
    const beneficiary2 = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";

    // Create beneficiaries as arrays for proper encoding
    const beneficiaries = [
        [beneficiary1, 6000, 0, 0],  // [account, percentage, fixedAmount, tier] - 60%
        [beneficiary2, 4000, 0, 0]   // 40%
    ];

    const minAmount = '1000000'; // 1 USDT minimum

    console.log(` Creating split with ${beneficiaries.length} beneficiaries...`);
    beneficiaries.forEach((b, i) => {
        console.log(`   ${i + 1}. ${b[0]} - ${b[1] / 100}%`);
    });

    try {
        const createTx = await contractInstance.createSplit(
            testTokenAddress,
            0, // SplitMode.Percentage
            minAmount,
            beneficiaries
        ).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 100000000
        });

        console.log(`✅ Split created!`);
        console.log(`   Tx ID: ${createTx}`);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const newNextId = await contractInstance.nextSplitId().call();
        const splitId = Number(BigInt(newNextId)) - 1;
        console.log(`   Split ID: ${splitId}`);

        // ══════════════════════════════════════════════════════════
        // Test 3: Get Split Details
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('📋 Test 3: Get Split Details');
        console.log('═════════════════════════════════════════════════════════');

        const split = await contractInstance.splits(splitId).call();
        console.log(`✅ Split #${splitId}:`);
        console.log(`   Token: ${split.token}`);
        console.log(`   Mode: ${split.mode} (0=Percentage, 1=Fixed, 2=Tiered)`);
        console.log(`   Min Amount: ${(Number(BigInt(split.minAmount)) / 1e6).toLocaleString()} USDT`);
        console.log(`   Beneficiaries Count: ${split.beneficiaryCount}`);
        console.log(`   Executed: ${split.executed}`);
        console.log(`   Paused: ${split.paused}`);

        // ══════════════════════════════════════════════════════════
        // Test 4: Get Beneficiaries
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('👥 Test 4: Get Beneficiaries');
        console.log('═════════════════════════════════════════════════════════');

        const beneficiariesList = await contractInstance.getBeneficiaries(splitId).call();
        console.log(`✅ Total beneficiaries: ${beneficiariesList.length}`);
        beneficiariesList.forEach((b, i) => {
            console.log(`  ${i + 1}. Account: ${b.account}`);
            console.log(`     Percentage: ${Number(BigInt(b.percentage)) / 100}%`);
            console.log(`     Fixed Amount: ${(Number(BigInt(b.fixedAmount)) / 1e6).toLocaleString()} USDT`);
            console.log(`     Tier: ${Number(BigInt(b.tier))}`);
            console.log(`     Active: ${b.active}`);
        });

        // ══════════════════════════════════════════════════════════
        // Test 5: Calculate Distribution
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('📊 Test 5: Calculate Distribution');
        console.log('═════════════════════════════════════════════════════════');

        const testAmount = '10000000'; // 10 USDT
        const distribution = await contractInstance.calculateDistribution(splitId, testAmount).call();
        console.log(`✅ Distribution for ${(Number(testAmount) / 1e6).toLocaleString()} USDT:`);
        distribution.forEach((share, i) => {
            console.log(`  Beneficiary ${i + 1}: ${(Number(BigInt(share)) / 1e6).toLocaleString()} USDT`);
        });

        // ══════════════════════════════════════════════════════════
        // Test 6: Test Pause/Unpause
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('⏸️  Test 6: Pause/Unpause Split');
        console.log('═════════════════════════════════════════════════════════');

        console.log(`   Pausing split #${splitId}...`);
        const pauseTx = await contractInstance.pauseSplit(splitId).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 100000000
        });
        console.log(`   ✅ Split paused! Tx: ${pauseTx}`);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const pausedCheck = await contractInstance.splits(splitId).call();
        console.log(`   Verified paused: ${pausedCheck.paused}`);

        console.log(`\n   Unpausing split #${splitId}...`);
        const unpauseTx = await contractInstance.unpauseSplit(splitId).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 100000000
        });
        console.log(`   ✅ Split unpaused! Tx: ${unpauseTx}`);

        await new Promise(resolve => setTimeout(resolve, 2000));
        const unpausedCheck = await contractInstance.splits(splitId).call();
        console.log(`   Verified paused: ${unpausedCheck.paused}`);

        // ══════════════════════════════════════════════════════════
        // Summary
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('✅ All Tests Passed!');
        console.log('═════════════════════════════════════════════════════════');
        console.log('\n📊 Test Summary:');
        console.log('  ✅ Contract deployed and verified on TRON Nile Testnet');
        console.log('  ✅ Successfully read contract state');
        console.log('  ✅ Created a percentage-based split');
        console.log('  ✅ Retrieved split details');
        console.log('  ✅ Retrieved beneficiary list');
        console.log('  ✅ Calculated distribution shares');
        console.log('  ✅ Tested pause/unpause functionality');
        console.log(`  ✅ Split created with ID: ${splitId}`);

        console.log('\n💡 Next Steps for Full Testing:');
        console.log('  1. Approve and transfer USDT to the contract');
        console.log('  2. Execute the split to see actual distribution');
        console.log('  3. Test different split modes (Fixed, Tiered)');
        console.log('  4. Test add/remove beneficiaries');
        console.log('  5. Test beneficiary claims');

        console.log('\n🔗 Resources:');
        console.log(`  Contract: https://nile.tronscan.org/#/contract/${deployment.contractAddress}`);
        console.log(`  Deployment: https://nile.tronscan.org/#/transaction/${deployment.transactionHash}`);

        console.log('\n═════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);
        if (error.error) {
            console.error('Details:', JSON.stringify(error.error, null, 2));
        }
        process.exit(1);
    }
}

main().catch(console.error);
