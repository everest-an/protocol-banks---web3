import { ethers } from "hardhat";

/**
 * Test deployed contracts on BSC Testnet
 * Usage: npx hardhat run scripts/test-bsc-deployed.ts --network bscTestnet
 */

const DEPLOYED = {
  BatchTransfer: "0xb13B597dFddf512B715367f7C6A8989De1340327",
  PaymentSplitter: "0xbAEea6B8b53272c4624df53B954ed8c72Fd25dD8",
  PaymentVault: "0x5251cB79961A0Fd227b50F21F2063c1D104215FB",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\n🧪 Testing deployed contracts on BSC Testnet\n`);
  console.log(`📍 Tester: ${deployer.address}\n`);

  let passed = 0;
  let failed = 0;

  // ── Test 1: BatchTransfer ────────────────────────────────
  console.log("━".repeat(50));
  console.log("📦 Testing BatchTransfer...");
  try {
    const bt = await ethers.getContractAt("BatchTransfer", DEPLOYED.BatchTransfer);
    const owner = await bt.owner();
    const maxBatch = await bt.maxBatchSize();
    const fee = await bt.platformFeeBps();
    const feeCollector = await bt.feeCollector();
    const stats = await bt.getStats();

    console.log(`   ✅ owner: ${owner}`);
    console.log(`   ✅ maxBatchSize: ${maxBatch}`);
    console.log(`   ✅ platformFeeBps: ${fee}`);
    console.log(`   ✅ feeCollector: ${feeCollector}`);
    console.log(`   ✅ stats: batches=${stats[0]}, recipients=${stats[1]}`);

    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("   ✅ Owner matches deployer");
      passed++;
    } else {
      console.log("   ❌ Owner mismatch!");
      failed++;
    }
    if (Number(maxBatch) === 200) {
      console.log("   ✅ maxBatchSize = 200");
      passed++;
    } else {
      failed++;
    }
    if (Number(fee) === 0) {
      console.log("   ✅ platformFeeBps = 0 (no fee)");
      passed++;
    } else {
      failed++;
    }
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message?.slice(0, 100)}`);
    failed++;
  }

  // ── Test 2: PaymentSplitter ──────────────────────────────
  console.log("\n📦 Testing PaymentSplitter...");
  try {
    const ps = await ethers.getContractAt("TronPaymentSplitter", DEPLOYED.PaymentSplitter);
    const owner = await ps.owner();
    const nextSplitId = await ps.nextSplitId();

    // Check if testnet USDT is supported
    const testUSDT = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
    const isSupported = await ps.isTokenSupported(testUSDT);

    console.log(`   ✅ owner: ${owner}`);
    console.log(`   ✅ nextSplitId: ${nextSplitId}`);
    console.log(`   ✅ testnet USDT supported: ${isSupported}`);

    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("   ✅ Owner matches deployer");
      passed++;
    } else {
      failed++;
    }
    if (isSupported) {
      console.log("   ✅ Testnet USDT token is supported");
      passed++;
    } else {
      console.log("   ❌ Testnet USDT not supported");
      failed++;
    }
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message?.slice(0, 100)}`);
    failed++;
  }

  // ── Test 3: PaymentVault ─────────────────────────────────
  console.log("\n📦 Testing PaymentVault...");
  try {
    const pv = await ethers.getContractAt("TronPaymentVault", DEPLOYED.PaymentVault);
    const threshold = await pv.threshold();
    const guardian = await pv.guardian();
    const paused = await pv.paused();
    const signers = await pv.getSigners();
    const nextPaymentId = await pv.nextPaymentId();

    // Check if testnet USDT is supported
    const testUSDT = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
    const isSupported = await pv.supportedTokens(testUSDT);

    console.log(`   ✅ threshold: ${threshold}`);
    console.log(`   ✅ guardian: ${guardian}`);
    console.log(`   ✅ paused: ${paused}`);
    console.log(`   ✅ signers: [${signers.join(", ")}]`);
    console.log(`   ✅ nextPaymentId: ${nextPaymentId}`);
    console.log(`   ✅ testnet USDT supported: ${isSupported}`);

    if (Number(threshold) === 1) {
      console.log("   ✅ Threshold = 1 (1-of-1)");
      passed++;
    } else {
      failed++;
    }
    if (!paused) {
      console.log("   ✅ Vault is not paused");
      passed++;
    } else {
      failed++;
    }
    if (guardian.toLowerCase() === deployer.address.toLowerCase()) {
      console.log("   ✅ Guardian matches deployer");
      passed++;
    } else {
      failed++;
    }
    if (signers.length === 1 && signers[0].toLowerCase() === deployer.address.toLowerCase()) {
      console.log("   ✅ Deployer is the sole signer");
      passed++;
    } else {
      failed++;
    }
    if (isSupported) {
      console.log("   ✅ Testnet USDT supported in vault");
      passed++;
    } else {
      failed++;
    }
  } catch (err: any) {
    console.log(`   ❌ Error: ${err.message?.slice(0, 100)}`);
    failed++;
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("\n" + "━".repeat(50));
  console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  });
