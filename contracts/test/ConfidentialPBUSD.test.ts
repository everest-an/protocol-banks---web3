import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * @title Confidential Protocol Bank FHE Test Suite
 * @description Tests for ConfidentialPBUSD and ConfidentialTreasury contracts
 *              using MockFHE coprocessor for local Hardhat testing.
 *
 * Test Architecture:
 *   - MockFHE is deployed as the FHE coprocessor
 *   - All FHE operations are computed in plaintext inside MockFHE
 *   - Tests verify business logic correctness, not encryption properties
 *   - For actual privacy/security testing, use Zama fhEVM devnet
 */
describe("Confidential Protocol Bank FHE System", function () {
  // ════════════════════════════════════════════════════════════════
  //                       FIXTURES
  // ════════════════════════════════════════════════════════════════
  let cpbusd: any;    // ConfidentialPBUSD
  let ctreasury: any; // ConfidentialTreasury
  let mockFHE: any;   // MockFHE coprocessor
  let mockUSDC: any;  // MockERC20

  let admin: SignerWithAddress;
  let minter: SignerWithAddress;
  let pauser: SignerWithAddress;
  let compliance: SignerWithAddress;
  let relayer: SignerWithAddress;
  let guardian: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeCollector: SignerWithAddress;

  const DAILY_MINT_CAP = ethers.parseUnits("1000000", 6); // 1M cPBUSD
  const DAILY_RELEASE_CAP = ethers.parseUnits("1000000", 6); // 1M USDC
  const EMERGENCY_DELAY = 86400; // 24 hours
  const INITIAL_USDC_BALANCE = ethers.parseUnits("10000000", 6); // 10M USDC

  beforeEach(async function () {
    [admin, minter, pauser, compliance, relayer, guardian, user1, user2, feeCollector] =
      await ethers.getSigners();

    // 1. Deploy MockFHE coprocessor
    const MockFHEFactory = await ethers.getContractFactory("MockFHE");
    mockFHE = await MockFHEFactory.deploy();
    const mockFHEAddress = await mockFHE.getAddress();

    // 2. Deploy MockUSDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = await MockERC20Factory.deploy("USD Coin", "USDC");
    const mockUSDCAddress = await mockUSDC.getAddress();

    // 3. Deploy ConfidentialPBUSD with MockFHE as coprocessor
    const CPBUSDFactory = await ethers.getContractFactory("ConfidentialPBUSD");
    cpbusd = await CPBUSDFactory.deploy(
      admin.address,
      minter.address,
      pauser.address,
      compliance.address,
      DAILY_MINT_CAP,
      mockFHEAddress, // coprocessor
      mockFHEAddress   // ACL (same address in mock)
    );

    // 4. Deploy ConfidentialTreasury with MockFHE
    const CTreasuryFactory = await ethers.getContractFactory("ConfidentialTreasury");
    ctreasury = await CTreasuryFactory.deploy(
      mockUSDCAddress,
      admin.address,
      relayer.address,
      guardian.address,
      DAILY_RELEASE_CAP,
      EMERGENCY_DELAY,
      mockFHEAddress,
      mockFHEAddress
    );

    // 5. Mint USDC to users for treasury deposits
    const treasuryAddress = await ctreasury.getAddress();
    await mockUSDC.mint(user1.address, INITIAL_USDC_BALANCE);
    await mockUSDC.mint(user2.address, INITIAL_USDC_BALANCE);
    await mockUSDC.connect(user1).approve(treasuryAddress, ethers.MaxUint256);
    await mockUSDC.connect(user2).approve(treasuryAddress, ethers.MaxUint256);

    // 6. Pre-fund treasury with USDC for release testing
    await mockUSDC.mint(treasuryAddress, INITIAL_USDC_BALANCE);
  });

  // ════════════════════════════════════════════════════════════════
  //              CONFIDENTIAL PBUSD TESTS
  // ════════════════════════════════════════════════════════════════

  describe("ConfidentialPBUSD", function () {
    // ──────────────────────────────────────────────────────────
    //  Token Metadata
    // ──────────────────────────────────────────────────────────
    describe("Metadata", function () {
      it("should have correct name, symbol, and decimals", async function () {
        expect(await cpbusd.name()).to.equal("Confidential Protocol Bank USD");
        expect(await cpbusd.symbol()).to.equal("cPBUSD");
        expect(await cpbusd.decimals()).to.equal(6);
      });

      it("should start with zero total supply", async function () {
        expect(await cpbusd.totalSupply()).to.equal(0);
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Confidential Minting
    // ──────────────────────────────────────────────────────────
    describe("Confidential Minting", function () {
      it("should allow minter to mint with encrypted balance storage", async function () {
        const amount = ethers.parseUnits("1000", 6); // 1000 cPBUSD

        await expect(cpbusd.connect(minter).mint(user1.address, amount))
          .to.emit(cpbusd, "ConfidentialMint")
          .withArgs(user1.address, amount);

        // Total supply should be updated (plaintext)
        expect(await cpbusd.totalSupply()).to.equal(amount);
        expect(await cpbusd.totalMinted()).to.equal(amount);

        // Balance should be an encrypted handle (not the plaintext amount)
        const encBalance = await cpbusd.balanceOf(user1.address);
        // In FHE mode (with MockFHE), the balance is an opaque bytes32 handle
        expect(encBalance).to.not.equal(ethers.ZeroHash);
      });

      it("should enforce daily mint cap", async function () {
        const overCap = DAILY_MINT_CAP + ethers.parseUnits("1", 6);
        await expect(
          cpbusd.connect(minter).mint(user1.address, overCap)
        ).to.be.revertedWithCustomError(cpbusd, "DailyMintCapExceeded");
      });

      it("should reset daily mint cap on new day", async function () {
        // Mint up to cap
        await cpbusd.connect(minter).mint(user1.address, DAILY_MINT_CAP);

        // Advance 1 day
        await time.increase(86400);

        // Should be able to mint again
        const amount = ethers.parseUnits("100", 6);
        await expect(cpbusd.connect(minter).mint(user1.address, amount))
          .to.not.be.reverted;
      });

      it("should reject non-minter mint attempts", async function () {
        await expect(
          cpbusd.connect(user1).mint(user1.address, 1000)
        ).to.be.reverted;
      });

      it("should accumulate encrypted balance across multiple mints", async function () {
        const amount1 = ethers.parseUnits("500", 6);
        const amount2 = ethers.parseUnits("300", 6);

        await cpbusd.connect(minter).mint(user1.address, amount1);
        await cpbusd.connect(minter).mint(user1.address, amount2);

        expect(await cpbusd.totalSupply()).to.equal(amount1 + amount2);
        expect(await cpbusd.totalMinted()).to.equal(amount1 + amount2);
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Confidential Transfer (plaintext amount variant)
    // ──────────────────────────────────────────────────────────
    describe("Confidential Transfer", function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      const transferAmount = ethers.parseUnits("300", 6);

      beforeEach(async function () {
        await cpbusd.connect(minter).mint(user1.address, mintAmount);
      });

      it("should transfer tokens with encrypted balance updates", async function () {
        await expect(
          cpbusd.connect(user1)["transfer(address,uint256)"](user2.address, transferAmount)
        )
          .to.emit(cpbusd, "ConfidentialTransfer")
          .withArgs(user1.address, user2.address);
      });

      it("should handle transfer to zero address", async function () {
        await expect(
          cpbusd.connect(user1)["transfer(address,uint256)"](ethers.ZeroAddress, transferAmount)
        ).to.be.revertedWithCustomError(cpbusd, "InvalidRecipient");
      });

      it("should block blacklisted sender", async function () {
        await cpbusd.connect(compliance).setBlacklist(user1.address, true);
        await expect(
          cpbusd.connect(user1)["transfer(address,uint256)"](user2.address, transferAmount)
        ).to.be.revertedWithCustomError(cpbusd, "SenderBlacklisted");
      });

      it("should block blacklisted recipient", async function () {
        await cpbusd.connect(compliance).setBlacklist(user2.address, true);
        await expect(
          cpbusd.connect(user1)["transfer(address,uint256)"](user2.address, transferAmount)
        ).to.be.revertedWithCustomError(cpbusd, "RecipientBlacklisted");
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Confidential Approve & TransferFrom
    // ──────────────────────────────────────────────────────────
    describe("Confidential Approve & TransferFrom", function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      const approveAmount = ethers.parseUnits("500", 6);

      beforeEach(async function () {
        await cpbusd.connect(minter).mint(user1.address, mintAmount);
      });

      it("should approve spender with encrypted allowance", async function () {
        await expect(
          cpbusd.connect(user1)["approve(address,uint256)"](user2.address, approveAmount)
        )
          .to.emit(cpbusd, "ConfidentialApproval")
          .withArgs(user1.address, user2.address);
      });

      it("should allow transferFrom after approval", async function () {
        await cpbusd.connect(user1)["approve(address,uint256)"](user2.address, approveAmount);

        const transferAmount = ethers.parseUnits("200", 6);
        await expect(
          cpbusd.connect(user2)["transferFrom(address,address,uint256)"](
            user1.address,
            user2.address,
            transferAmount
          )
        )
          .to.emit(cpbusd, "ConfidentialTransfer")
          .withArgs(user1.address, user2.address);
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Confidential Burn & Redeem
    // ──────────────────────────────────────────────────────────
    describe("Confidential Burn & Redeem", function () {
      const mintAmount = ethers.parseUnits("1000", 6);

      beforeEach(async function () {
        await cpbusd.connect(minter).mint(user1.address, mintAmount);
      });

      it("should burn and emit redeem request", async function () {
        const burnAmount = ethers.parseUnits("500", 6);

        await expect(
          cpbusd.connect(user1).burnAndRedeem(burnAmount, user1.address)
        )
          .to.emit(cpbusd, "ConfidentialBurn")
          .withArgs(user1.address, burnAmount)
          .to.emit(cpbusd, "RedeemRequested");

        expect(await cpbusd.totalBurned()).to.equal(burnAmount);
        expect(await cpbusd.totalSupply()).to.equal(mintAmount - burnAmount);
      });

      it("should reject burn with zero amount", async function () {
        await expect(
          cpbusd.connect(user1).burnAndRedeem(0, user1.address)
        ).to.be.revertedWithCustomError(cpbusd, "InvalidAmount");
      });

      it("should reject burn with zero recipient", async function () {
        await expect(
          cpbusd.connect(user1).burnAndRedeem(100, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(cpbusd, "InvalidRecipient");
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Compliance & Administration
    // ──────────────────────────────────────────────────────────
    describe("Administration", function () {
      it("should allow compliance to update blacklist", async function () {
        await expect(cpbusd.connect(compliance).setBlacklist(user1.address, true))
          .to.emit(cpbusd, "BlacklistUpdated")
          .withArgs(user1.address, true);
        expect(await cpbusd.isBlacklisted(user1.address)).to.equal(true);
      });

      it("should allow admin to update daily mint cap", async function () {
        const newCap = ethers.parseUnits("2000000", 6);
        await expect(cpbusd.connect(admin).setDailyMintCap(newCap))
          .to.emit(cpbusd, "DailyMintCapUpdated");
      });

      it("should allow fee manager to set transfer fee", async function () {
        await expect(cpbusd.connect(admin).setTransferFee(25)) // 0.25%
          .to.emit(cpbusd, "TransferFeeUpdated");
        expect(await cpbusd.transferFeeBps()).to.equal(25);
      });

      it("should reject fee above MAX_FEE_BPS", async function () {
        await expect(
          cpbusd.connect(admin).setTransferFee(51)
        ).to.be.revertedWithCustomError(cpbusd, "FeeTooHigh");
      });

      it("should allow pauser to pause/unpause", async function () {
        await cpbusd.connect(pauser).pause();
        expect(await cpbusd.paused()).to.equal(true);

        await cpbusd.connect(pauser).unpause();
        expect(await cpbusd.paused()).to.equal(false);
      });

      it("should block minting when paused", async function () {
        await cpbusd.connect(pauser).pause();
        await expect(
          cpbusd.connect(minter).mint(user1.address, 1000)
        ).to.be.reverted;
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  //            CONFIDENTIAL TREASURY TESTS
  // ════════════════════════════════════════════════════════════════

  describe("ConfidentialTreasury", function () {
    // ──────────────────────────────────────────────────────────
    //  Confidential Deposit
    // ──────────────────────────────────────────────────────────
    describe("Confidential Deposit", function () {
      it("should accept USDC deposit with encrypted tracking", async function () {
        const amount = ethers.parseUnits("1000", 6);

        await expect(
          ctreasury.connect(user1).depositToHashKey(amount, user1.address)
        )
          .to.emit(ctreasury, "DepositForMint")
          .withArgs(user1.address, amount, user1.address, (v: any) => true);

        expect(await ctreasury.totalDeposited()).to.equal(amount);

        // Encrypted deposit tracking should be set
        const encDeposit = await ctreasury.encryptedDepositsOf(user1.address);
        expect(encDeposit).to.not.equal(ethers.ZeroHash);
      });

      it("should reject zero amount deposit", async function () {
        await expect(
          ctreasury.connect(user1).depositToHashKey(0, user1.address)
        ).to.be.revertedWithCustomError(ctreasury, "InvalidAmount");
      });

      it("should reject zero address recipient", async function () {
        await expect(
          ctreasury.connect(user1).depositToHashKey(1000, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(ctreasury, "InvalidRecipient");
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Confidential Release
    // ──────────────────────────────────────────────────────────
    describe("Confidential Release", function () {
      it("should release USDC with encrypted tracking", async function () {
        const amount = ethers.parseUnits("500", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn-tx-1"));

        await expect(
          ctreasury.connect(relayer).releaseFromBurn(user1.address, amount, burnTxHash)
        )
          .to.emit(ctreasury, "ConfidentialRelease")
          .withArgs(user1.address, burnTxHash, relayer.address, (v: any) => true);

        expect(await ctreasury.totalReleased()).to.equal(amount);
        expect(await ctreasury.isBurnProcessed(burnTxHash)).to.equal(true);
      });

      it("should prevent double-release with same burnTxHash", async function () {
        const amount = ethers.parseUnits("500", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn-tx-2"));

        await ctreasury.connect(relayer).releaseFromBurn(user1.address, amount, burnTxHash);

        await expect(
          ctreasury.connect(relayer).releaseFromBurn(user1.address, amount, burnTxHash)
        ).to.be.revertedWithCustomError(ctreasury, "BurnTxAlreadyProcessed");
      });

      it("should enforce daily release cap", async function () {
        const overCap = DAILY_RELEASE_CAP + ethers.parseUnits("1", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn-tx-over"));

        await expect(
          ctreasury.connect(relayer).releaseFromBurn(user1.address, overCap, burnTxHash)
        ).to.be.revertedWithCustomError(ctreasury, "DailyReleaseCapExceeded");
      });

      it("should reject non-relayer release attempts", async function () {
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn-tx-unauth"));
        await expect(
          ctreasury.connect(user1).releaseFromBurn(user1.address, 1000, burnTxHash)
        ).to.be.reverted;
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Emergency Withdrawal (Plaintext variant)
    // ──────────────────────────────────────────────────────────
    describe("Emergency Withdrawal", function () {
      it("should request and execute emergency withdrawal", async function () {
        const amount = ethers.parseUnits("100000", 6);

        // Request
        const tx = await ctreasury.connect(guardian)["requestEmergencyWithdraw(address,uint256)"](
          guardian.address,
          amount
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(
          (l: any) => l.fragment?.name === "EmergencyWithdrawRequested"
        );
        const requestHash = event?.args?.requestHash;

        // Time travel past delay
        await time.increase(EMERGENCY_DELAY + 1);

        // Execute
        await expect(
          ctreasury.connect(guardian).executeEmergencyWithdraw(requestHash, amount)
        )
          .to.emit(ctreasury, "EmergencyWithdrawExecuted")
          .withArgs(guardian.address, guardian.address, requestHash);
      });

      it("should reject early execution", async function () {
        const amount = ethers.parseUnits("100000", 6);

        const tx = await ctreasury.connect(guardian)["requestEmergencyWithdraw(address,uint256)"](
          guardian.address,
          amount
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(
          (l: any) => l.fragment?.name === "EmergencyWithdrawRequested"
        );
        const requestHash = event?.args?.requestHash;

        // Try to execute immediately (should fail)
        await expect(
          ctreasury.connect(guardian).executeEmergencyWithdraw(requestHash, amount)
        ).to.be.revertedWithCustomError(ctreasury, "EmergencyNotReady");
      });

      it("should allow admin to cancel emergency request", async function () {
        const amount = ethers.parseUnits("100000", 6);

        const tx = await ctreasury.connect(guardian)["requestEmergencyWithdraw(address,uint256)"](
          guardian.address,
          amount
        );
        const receipt = await tx.wait();
        const event = receipt.logs.find(
          (l: any) => l.fragment?.name === "EmergencyWithdrawRequested"
        );
        const requestHash = event?.args?.requestHash;

        await expect(
          ctreasury.connect(admin).cancelEmergencyWithdraw(requestHash)
        ).to.emit(ctreasury, "EmergencyWithdrawCanceled");
      });
    });

    // ──────────────────────────────────────────────────────────
    //  Administration
    // ──────────────────────────────────────────────────────────
    describe("Administration", function () {
      it("should allow guardian to pause", async function () {
        await ctreasury.connect(guardian).pause();
        expect(await ctreasury.paused()).to.equal(true);
      });

      it("should allow admin to unpause", async function () {
        await ctreasury.connect(guardian).pause();
        await ctreasury.connect(admin).unpause();
        expect(await ctreasury.paused()).to.equal(false);
      });

      it("should update daily release cap", async function () {
        const newCap = ethers.parseUnits("2000000", 6);
        await expect(ctreasury.connect(admin).setDailyReleaseCap(newCap))
          .to.emit(ctreasury, "DailyReleaseCapUpdated");
      });

      it("should report correct view functions", async function () {
        expect(await ctreasury.vaultBalance()).to.equal(INITIAL_USDC_BALANCE);
        expect(await ctreasury.netDeposited()).to.equal(0);
        expect(await ctreasury.remainingDailyRelease()).to.equal(DAILY_RELEASE_CAP);
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  //              MOCK FHE COPROCESSOR TESTS
  // ════════════════════════════════════════════════════════════════

  describe("MockFHE Coprocessor", function () {
    it("should encrypt and store plaintext values", async function () {
      const tx = await mockFHE.asEuint64(42);
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      );
      const handle = event?.args?.handle;
      expect(await mockFHE.revealPlaintext(handle)).to.equal(42);
    });

    it("should perform homomorphic addition", async function () {
      const h1 = (await (await mockFHE.asEuint64(100)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;
      const h2 = (await (await mockFHE.asEuint64(200)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;

      const addTx = await mockFHE.add(h1, h2);
      const addReceipt = await addTx.wait();
      const resultHandle = addReceipt.logs.find(
        (l: any) => l.fragment?.name === "MockOperation"
      )?.args?.result;

      expect(await mockFHE.revealPlaintext(resultHandle)).to.equal(300);
    });

    it("should perform homomorphic comparison (le)", async function () {
      const h1 = (await (await mockFHE.asEuint64(50)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;
      const h2 = (await (await mockFHE.asEuint64(100)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;

      const leTx = await mockFHE.le(h1, h2);
      const leReceipt = await leTx.wait();
      const resultHandle = leReceipt.logs.find(
        (l: any) => l.fragment?.name === "MockOperation"
      )?.args?.result;

      expect(await mockFHE.revealPlaintext(resultHandle)).to.equal(1); // true
    });

    it("should perform conditional select", async function () {
      // Condition: true
      const condTrue = (await (await mockFHE.asEbool(true)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;

      const valA = (await (await mockFHE.asEuint64(42)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;

      const valB = (await (await mockFHE.asEuint64(99)).wait()).logs.find(
        (l: any) => l.fragment?.name === "MockEncrypt"
      )?.args?.handle;

      const selectTx = await mockFHE.select(condTrue, valA, valB);
      const selectReceipt = await selectTx.wait();
      const resultHandle = selectReceipt.logs.find(
        (l: any) => l.fragment?.name === "MockOperation"
      )?.args?.result;

      expect(await mockFHE.revealPlaintext(resultHandle)).to.equal(42);
    });
  });
});
