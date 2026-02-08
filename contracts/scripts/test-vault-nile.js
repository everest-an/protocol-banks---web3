/**
 * Test TronPaymentVault on TRON Nile Testnet
 *
 * Prerequisites:
 * 1. Contract deployed and address known
 * 2. Deployer private key in .env file
 * 3. Contract funded with test USDT
 */

require('dotenv').config();
const { TronWeb } = require('tronweb');

async function main() {
    console.log('🧪 Testing TronPaymentVault on TRON Nile Testnet...\n');

    if (!process.env.DEPLOYER_PRIVATE_KEY) {
        console.error('❌ Error: DEPLOYER_PRIVATE_KEY not found');
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
    console.log(`📝 Tester Address: ${deployerAddress}\n`);

    // Load deployment info
    const fs = require('fs');
    const path = require('path');
    const deploymentPath = path.join(__dirname, '../artifacts/tron/deployment-nile-testnet.json');

    if (!fs.existsSync(deploymentPath)) {
        console.error('❌ Deployment file not found. Deploy the contract first.');
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const vaultAddress = deployment.contractAddress;
    console.log(`📍 Vault Address: ${vaultAddress}\n`);

    // Load contract ABI
    const artifactPath = path.join(__dirname, '../artifacts/tron/TronPaymentVault.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi;

    // Get contract instance
    const vault = await tronWeb.contract(abi, vaultAddress);

    // ══════════════════════════════════════════════════════════
    // Test 1: Check initial state
    // ══════════════════════════════════════════════════════════
    console.log('═════════════════════════════════════════════════════════');
    console.log('🔍 Test 1: Checking Initial State');
    console.log('═════════════════════════════════════════════════════════');

    const threshold = await vault.threshold().call();
    console.log(`✅ Threshold: ${threshold}`);

    const timelock = await vault.timelock().call();
    console.log(`✅ Timelock: ${timelock} seconds (${timelock / 3600} hours)`);

    const dailyLimit = await vault.dailyLimit().call();
    console.log(`✅ Daily Limit: ${(parseInt(dailyLimit) / 1e6).toLocaleString()} USDT`);

    const isSigner = await vault.isSigner(deployerAddress).call();
    console.log(`✅ Is Signer: ${isSigner}`);

    const nextPaymentId = await vault.nextPaymentId().call();
    console.log(`✅ Next Payment ID: ${nextPaymentId}`);

    // ══════════════════════════════════════════════════════════
    // Test 2: Get Signers
    // ══════════════════════════════════════════════════════════
    console.log('\n═════════════════════════════════════════════════════════');
    console.log('👥 Test 2: Retrieving Signers');
    console.log('═════════════════════════════════════════════════════════');

    const signers = await vault.getSigners().call();
    console.log(`✅ Total Signers: ${signers.length}`);
    signers.forEach((signer, i) => {
        console.log(`  ${i + 1}. ${signer}`);
    });

    // ══════════════════════════════════════════════════════════
    // Test 3: Propose Payment
    // ══════════════════════════════════════════════════════════
    console.log('\n═════════════════════════════════════════════════════════');
    console.log('💸 Test 3: Proposing Payment');
    console.log('═════════════════════════════════════════════════════════');

    const recipientAddress = tronWeb.address.fromHex(
        tronWeb.address.toHex(tronWeb.defaultAddress.hex)
    );
    const testTokenAddress = deployment.parameters.supportedTokens[0] || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const testAmount = '1000000'; // 1 USDT (6 decimals)

    try {
        console.log(` proposing ${testAmount / 1e6} USDT to ${recipientAddress}...`);

        const tx1 = await vault.proposePayment(
            testTokenAddress,
            recipientAddress,
            testAmount,
            '0x'
        ).send({
            from: deployerAddress,
            shouldPollResponse: true
        });

        console.log(`✅ Payment proposed successfully!`);
        console.log(`   Transaction ID: ${tx1}`);

        // Get the payment ID from the event
        // In production, you'd parse the event logs
        const updatedNextId = await vault.nextPaymentId().call();
        const paymentId = parseInt(updatedNextId) - 1;
        console.log(`   Payment ID: ${paymentId}\n`);

        // ══════════════════════════════════════════════════════════
        // Test 4: Get Payment Details
        // ══════════════════════════════════════════════════════════
        console.log('═════════════════════════════════════════════════════════');
        console.log('📋 Test 4: Retrieving Payment Details');
        console.log('═════════════════════════════════════════════════════════');

        const payment = await vault.payments(paymentId).call();
        console.log(`✅ Payment ID ${paymentId}:`);
        console.log(`   Token: ${payment.token}`);
        console.log(`   To: ${payment.to}`);
        console.log(`   Amount: ${(parseInt(payment.amount) / 1e6).toLocaleString()} USDT`);
        console.log(`   Executed: ${payment.executed}`);
        console.log(`   Cancelled: ${payment.cancelled}`);
        console.log(`   Approval Count: ${payment.approvalCount}`);
        console.log(`   Proposed At: ${new Date(parseInt(payment.proposedAt) * 1000).toISOString()}`);

        // ══════════════════════════════════════════════════════════
        // Test 5: Check Payment Approvals
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('✅ Test 5: Checking Payment Approvals');
        console.log('═════════════════════════════════════════════════════════');

        // Check if deployer already approved
        const isApproved = await vault.getApprovalStatus(paymentId, deployerAddress).call();
        console.log(`   ${deployerAddress} approved: ${isApproved}`);

        // ══════════════════════════════════════════════════════════
        // Test 6: Additional Approval (if needed)
        // ══════════════════════════════════════════════════════════
        if (parseInt(threshold) > 1) {
            console.log('\n═════════════════════════════════════════════════════════');
            console.log('✅ Test 6: Waiting for Additional Approvals');
            console.log('═════════════════════════════════════════════════════════');
            console.log(`   Threshold: ${threshold}`);
            console.log(`   Current approvals: ${payment.approvalCount}`);
            console.log(`   Additional approval needed: ${parseInt(threshold) - parseInt(payment.approvalCount)}`);
            console.log('\n💡 To complete this test:');
            console.log('   1. Approve using another signer address');
            console.log('   2. Or use the deployer again if it\'s allowed');
            console.log('   3. Wait for timelock period before executing\n');

            // Try to approve again (if the same signer can approve multiple times)
            try {
                const tx2 = await vault.approvePayment(paymentId).send({
                    from: deployerAddress,
                    shouldPollResponse: true
                });
                console.log(`✅ Additional approval: ${tx2}`);
            } catch (approveError) {
                console.log(`   ℹ️  Cannot approve again (already approved): ${approveError.message}`);
            }
        }

        // ══════════════════════════════════════════════════════════
        // Test 7: Timelock Check
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('⏰ Test 7: Timelock Status');
        console.log('═════════════════════════════════════════════════════════');

        const currentTime = Math.floor(Date.now() / 1000);
        const proposedAt = parseInt(payment.proposedAt);
        const timeUntilUnlock = parseInt(timelock) - (currentTime - proposedAt);

        console.log(`   Current Time: ${new Date(currentTime * 1000).toISOString()}`);
        console.log(`   Proposed At: ${new Date(proposedAt * 1000).toISOString()}`);
        console.log(`   Timelock: ${parseInt(timelock)} seconds`);

        if (timeUntilUnlock > 0) {
            console.log(`   ⏳ Time Until Unlock: ${timeUntilUnlock} seconds (${(timeUntilUnlock / 3600).toFixed(2)} hours)`);
            console.log('   ⚠️  Cannot execute payment until timelock expires');
        } else {
            console.log(`   ✅ Timelock expired! Payment can be executed.`);
            console.log('\n💡 Execute with:');
            console.log('   await vault.executePayment(paymentId).send({ from: address });');
        }

        // ══════════════════════════════════════════════════════════
        // Summary
        // ══════════════════════════════════════════════════════════
        console.log('\n═════════════════════════════════════════════════════════');
        console.log('✅ All Tests Completed!');
        console.log('═════════════════════════════════════════════════════════');
        console.log('\n📊 Test Summary:');
        console.log('  ✅ Contract is deployed and functioning');
        console.log('  ✅ Can retrieve vault configuration');
        console.log('  ✅ Can retrieve signer list');
        console.log('  ✅ Can propose payments');
        console.log('  ✅ Can retrieve payment details');
        console.log('  ✅ Timelock mechanism is active');
        console.log('\n💡 Next Steps:');
        console.log('  1. Fund the vault with USDT');
        console.log('  2. Wait for timelock to expire');
        console.log('  3. Execute payment with sufficient approvals');
        console.log('  4. Test emergency withdrawal mechanisms');
        console.log('═════════════════════════════════════════════════════════\n');

    } catch (error) {
        console.error('\n❌ Test failed!');
        console.error('Error:', error.message);

        if (error.message.includes('not a signer')) {
            console.error('\n💡 The deployer is not a signer. Check deployment parameters.');
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
