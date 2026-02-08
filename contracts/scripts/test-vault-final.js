require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🧪 TronPaymentVault - TRON Nile Testnet Test Suite\n');

    const tronWeb = new TronWeb({
        fullNode: 'https://nile.trongrid.io',
        solidityNode: 'https://nile.trongrid.io',
        eventServer: 'https://nile.trongrid.io'
    });

    const fs = require('fs');
    const path = require('path');

    // Load deployment info
    const deployment = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/deployment-nile-testnet.json'), 'utf8')
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
        fs.readFileSync(path.join(__dirname, '../artifacts/tron/TronPaymentVault.json'), 'utf8')
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

            // Get transaction info to check if it's confirmed
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

            // Try to create contract instance
            contractInstance = await tronWeb.contract(abi, deployment.contractAddress);

            // Try to access contract
            const testCall = await contractInstance.threshold().call();
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

    const threshold = await contractInstance.threshold().call();
    const thresholdNum = Number(BigInt(threshold));
    console.log(`✓ Threshold: ${thresholdNum}`);

    const timelock = await contractInstance.timelock().call();
    const timelockNum = Number(BigInt(timelock));
    console.log(`✓ Timelock: ${timelockNum} seconds (${(timelockNum / 3600).toFixed(2)} hours)`);

    const dailyLimit = await contractInstance.dailyLimit().call();
    const dailyLimitNum = Number(BigInt(dailyLimit));
    console.log(`✓ Daily Limit: ${(dailyLimitNum / 1e6).toLocaleString()} USDT`);

    const isPaused = await contractInstance.paused().call();
    console.log(`✓ Paused: ${isPaused}`);

    const nextPaymentId = await contractInstance.nextPaymentId().call();
    const nextPaymentIdNum = Number(BigInt(nextPaymentId));
    console.log(`✓ Next Payment ID: ${nextPaymentIdNum}`);

    const isSigner = await contractInstance.isSigner(testerAddress).call();
    console.log(`✓ Tester is signer: ${isSigner}`);

    // ══════════════════════════════════════════════════════════
    // Test 2: Get Signers
    // ══════════════════════════════════════════════════════════
    console.log('\n═════════════════════════════════════════════════════════');
    console.log('👥 Test 2: Get Signers');
    console.log('═════════════════════════════════════════════════════════');

    const signers = await contractInstance.getSigners().call();
    console.log(`✅ Total signers: ${signers.length}`);
    signers.forEach((signer, i) => {
        console.log(`  ${i + 1}. ${signer}`);
    });

    // ══════════════════════════════════════════════════════════
    // Test 3: Propose Payment
    // ══════════════════════════════════════════════════════════
    console.log('\n═════════════════════════════════════════════════════════');
    console.log('💸 Test 3: Propose Payment');
    console.log('═════════════════════════════════════════════════════════');

    const testTokenAddress = deployment.config.supportedTokens[0];
    const testAmount = '1000000'; // 1 USDT (6 decimals)
    const testData = '0x';

    console.log(` proposing ${Number(testAmount) / 1e6} USDT to ${testerAddress}...`);

    try {
        const proposeTx = await contractInstance.proposePayment(
            testTokenAddress,
            testerAddress,
            testAmount,
            testData
        ).send({
            from: testerAddress,
            shouldPollResponse: true,
            feeLimit: 100000000
        });

        console.log(`✅ Payment proposed!`);
        console.log(`   Tx ID: ${proposeTx}`);

        // Wait and get the payment ID
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newNextId = await contractInstance.nextPaymentId().call();
        const paymentId = Number(BigInt(newNextId)) - 1;
        console.log(`   Payment ID: ${paymentId}`);

        // ══════════════════════════════════════════════════════════
        // Test 4: Get Payment Details
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('📋 Test 4: Get Payment Details');
        console.log('═════════════════════════════════════════════════════════');

        const payment = await contractInstance.payments(paymentId).call();
        const amountNum = Number(BigInt(payment.amount));
        const approvalCountNum = Number(BigInt(payment.approvalCount));
        const proposedAtNum = Number(BigInt(payment.proposedAt));

        console.log(`✅ Payment #${paymentId}:`);
        console.log(`   Token: ${payment.token}`);
        console.log(`   To: ${payment.to}`);
        console.log(`   Amount: ${(amountNum / 1e6).toLocaleString()} USDT`);
        console.log(`   Executed: ${payment.executed}`);
        console.log(`   Cancelled: ${payment.cancelled}`);
        console.log(`   Approvals: ${approvalCountNum} / ${thresholdNum}`);
        console.log(`   Proposed: ${new Date(proposedAtNum * 1000).toLocaleString()}`);

        // ══════════════════════════════════════════════════════════
        // Test 5: Additional Approval
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('✅ Test 5: Additional Approval');
        console.log('═════════════════════════════════════════════════════════');

        if (approvalCountNum < thresholdNum) {
            const needed = thresholdNum - approvalCountNum;
            console.log(`   Need ${needed} more approval(s)...`);

            if (needed > 0 && deployment.config.threshold > 1) {
                console.log(`   Approving payment from ${testerAddress}...`);
                const approveTx = await contractInstance.approvePayment(paymentId).send({
                    from: testerAddress,
                    shouldPollResponse: true,
                    feeLimit: 100000000
                });
                console.log(`   ✅ Approved! Tx: ${approveTx}`);

                await new Promise(resolve => setTimeout(resolve, 2000));
                const updatedPayment = await contractInstance.payments(paymentId).call();
                const updatedCount = Number(BigInt(updatedPayment.approvalCount));
                console.log(`   Current approvals: ${updatedCount} / ${thresholdNum}`);
            }
        } else {
            console.log(`   ✅ Already has ${thresholdNum} approval(s)`);
        }

        // ══════════════════════════════════════════════════════════
        // Test 6: Timelock Check
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('⏰ Test 6: Timelock Status');
        console.log('═════════════════════════════════════════════════════════');

        const currentTime = Math.floor(Date.now() / 1000);
        const secondsRemaining = timelockNum - (currentTime - proposedAtNum);

        console.log(`   Timelock: ${timelockNum}s (${(timelockNum/3600).toFixed(2)}h)`);
        console.log(`   Proposed: ${new Date(proposedAtNum * 1000).toLocaleString()}`);
        console.log(`   Current: ${new Date(currentTime * 1000).toLocaleString()}`);

        if (secondsRemaining > 0) {
            console.log(`   ⏳ Time remaining: ${secondsRemaining}s (${(secondsRemaining/60).toFixed(1)}min)`);
            console.log(`   ℹ️  Payment cannot be executed until timelock expires`);
        } else {
            console.log(`   ✅ Timelock expired! Payment can be executed.`);
        }

        // ══════════════════════════════════════════════════════════
        // Summary
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('✅ All Tests Passed!');
        console.log('═════════════════════════════════════════════════════════');
        console.log('\n📊 Test Summary:');
        console.log('  ✅ Contract deployed and verified on TRON Nile Testnet');
        console.log('  ✅ Successfully read contract state');
        console.log('  ✅ Retrieved signer list');
        console.log('  ✅ Proposed a new payment');
        console.log('  ✅ Retrieved payment details');
        console.log('  ✅ Timelock mechanism is active');
        console.log(`  ✅ Payment created with ID: ${paymentId}`);

        console.log('\n💡 Next Steps for Full Testing:');
        console.log('  1. Fund the vault with USDT (transfer to contract address)');
        console.log('  2. Wait for timelock to expire (24h or deploy with timelock=0 for testing)');
        console.log('  3. Execute payment to verify full flow');
        console.log('  4. Test emergency withdrawal mechanisms');
        console.log('  5. Test daily limit enforcement');

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
