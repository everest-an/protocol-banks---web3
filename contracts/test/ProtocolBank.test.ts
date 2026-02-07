import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ProtocolBankUSD, ProtocolBankTreasury, MockERC20 } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Protocol Bank USD System", function () {
  // ════════════════════════════════════════════════════════════════
  //                       FIXTURES
  // ════════════════════════════════════════════════════════════════
  let pbUSD: ProtocolBankUSD;
  let treasury: ProtocolBankTreasury;
  let mockUSDC: MockERC20;

  let admin: SignerWithAddress;
  let minter: SignerWithAddress;
  let pauser: SignerWithAddress;
  let compliance: SignerWithAddress;
  let relayer: SignerWithAddress;
  let guardian: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let feeCollector: SignerWithAddress;

  const DAILY_MINT_CAP = ethers.parseUnits("1000000", 6); // 1M pbUSD
  const DAILY_RELEASE_CAP = ethers.parseUnits("1000000", 6); // 1M USDC (6 decimals)
  const EMERGENCY_DELAY = 86400; // 24 hours
  const INITIAL_USDC_BALANCE = ethers.parseUnits("10000000", 6); // 10M USDC

  beforeEach(async function () {
    [admin, minter, pauser, compliance, relayer, guardian, user1, user2, feeCollector] =
      await ethers.getSigners();

    // Deploy MockUSDC
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockUSDC = (await MockERC20Factory.deploy("USD Coin", "USDC")) as MockERC20;

    // Deploy pbUSD
    const PbUSDFactory = await ethers.getContractFactory("ProtocolBankUSD");
    pbUSD = (await PbUSDFactory.deploy(
      admin.address,
      minter.address,
      pauser.address,
      compliance.address,
      DAILY_MINT_CAP
    )) as ProtocolBankUSD;

    // Deploy Treasury
    const TreasuryFactory = await ethers.getContractFactory("ProtocolBankTreasury");
    treasury = (await TreasuryFactory.deploy(
      await mockUSDC.getAddress(),
      admin.address,
      relayer.address,
      guardian.address,
      DAILY_RELEASE_CAP,
      EMERGENCY_DELAY
    )) as ProtocolBankTreasury;

    // Mint USDC to user1 for deposits
    await mockUSDC.mint(user1.address, INITIAL_USDC_BALANCE);
    await mockUSDC.connect(user1).approve(await treasury.getAddress(), INITIAL_USDC_BALANCE);
  });

  // ════════════════════════════════════════════════════════════════
  //                    pbUSD TOKEN TESTS
  // ════════════════════════════════════════════════════════════════

  describe("ProtocolBankUSD", function () {
    // ── Deployment ──────────────────────────────────────────────
    describe("Deployment", function () {
      it("should set correct name and symbol", async function () {
        expect(await pbUSD.name()).to.equal("Protocol Bank USD");
        expect(await pbUSD.symbol()).to.equal("pbUSD");
      });

      it("should assign roles correctly", async function () {
        const MINTER_ROLE = await pbUSD.MINTER_ROLE();
        const PAUSER_ROLE = await pbUSD.PAUSER_ROLE();
        const COMPLIANCE_ROLE = await pbUSD.COMPLIANCE_ROLE();
        const DEFAULT_ADMIN_ROLE = await pbUSD.DEFAULT_ADMIN_ROLE();

        expect(await pbUSD.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
        expect(await pbUSD.hasRole(MINTER_ROLE, minter.address)).to.be.true;
        expect(await pbUSD.hasRole(PAUSER_ROLE, pauser.address)).to.be.true;
        expect(await pbUSD.hasRole(COMPLIANCE_ROLE, compliance.address)).to.be.true;
      });

      it("should set daily mint cap", async function () {
        expect(await pbUSD.dailyMintCap()).to.equal(DAILY_MINT_CAP);
      });

      it("should have zero initial supply", async function () {
        expect(await pbUSD.totalSupply()).to.equal(0);
      });
    });

    // ── Minting ─────────────────────────────────────────────────
    describe("Minting", function () {
      it("should allow minter to mint tokens", async function () {
        const amount = ethers.parseUnits("1000", 6);
        await pbUSD.connect(minter).mint(user1.address, amount);
        expect(await pbUSD.balanceOf(user1.address)).to.equal(amount);
      });

      it("should track totalMinted", async function () {
        const amount = ethers.parseUnits("5000", 6);
        await pbUSD.connect(minter).mint(user1.address, amount);
        expect(await pbUSD.totalMinted()).to.equal(amount);
      });

      it("should revert if non-minter tries to mint", async function () {
        const amount = ethers.parseUnits("100", 6);
        await expect(
          pbUSD.connect(user1).mint(user1.address, amount)
        ).to.be.reverted;
      });

      it("should revert if minting zero amount", async function () {
        await expect(
          pbUSD.connect(minter).mint(user1.address, 0)
        ).to.be.revertedWithCustomError(pbUSD, "InvalidAmount");
      });

      it("should revert if minting to zero address", async function () {
        await expect(
          pbUSD.connect(minter).mint(ethers.ZeroAddress, ethers.parseUnits("100", 6))
        ).to.be.revertedWithCustomError(pbUSD, "InvalidRecipient");
      });
    });

    // ── Daily Mint Cap ──────────────────────────────────────────
    describe("Daily Mint Cap", function () {
      it("should enforce daily mint cap", async function () {
        const overCap = DAILY_MINT_CAP + ethers.parseUnits("1", 6);
        await expect(
          pbUSD.connect(minter).mint(user1.address, overCap)
        ).to.be.revertedWithCustomError(pbUSD, "DailyMintCapExceeded");
      });

      it("should allow minting up to the cap", async function () {
        await pbUSD.connect(minter).mint(user1.address, DAILY_MINT_CAP);
        expect(await pbUSD.balanceOf(user1.address)).to.equal(DAILY_MINT_CAP);
      });

      it("should reset cap on a new day", async function () {
        await pbUSD.connect(minter).mint(user1.address, DAILY_MINT_CAP);

        // Advance to next day
        await time.increase(86400);

        // Should be able to mint again
        await pbUSD.connect(minter).mint(user1.address, DAILY_MINT_CAP);
        expect(await pbUSD.balanceOf(user1.address)).to.equal(DAILY_MINT_CAP * 2n);
      });

      it("should allow admin to update daily mint cap", async function () {
        const newCap = ethers.parseUnits("2000000", 6);
        await pbUSD.connect(admin).setDailyMintCap(newCap);
        expect(await pbUSD.dailyMintCap()).to.equal(newCap);
      });

      it("should report remaining daily mint correctly", async function () {
        const half = DAILY_MINT_CAP / 2n;
        await pbUSD.connect(minter).mint(user1.address, half);
        expect(await pbUSD.remainingDailyMint()).to.equal(half);
      });
    });

    // ── Burn & Redeem ───────────────────────────────────────────
    describe("Burn & Redeem", function () {
      const mintAmount = ethers.parseUnits("10000", 6);

      beforeEach(async function () {
        await pbUSD.connect(minter).mint(user1.address, mintAmount);
      });

      it("should burn tokens and emit RedeemRequested", async function () {
        const burnAmount = ethers.parseUnits("5000", 6);
        await expect(
          pbUSD.connect(user1).burnAndRedeem(burnAmount, user2.address)
        )
          .to.emit(pbUSD, "RedeemRequested")
          .withArgs(user1.address, burnAmount, user2.address, await time.latest() + 1);
      });

      it("should track totalBurned", async function () {
        const burnAmount = ethers.parseUnits("3000", 6);
        await pbUSD.connect(user1).burnAndRedeem(burnAmount, user2.address);
        expect(await pbUSD.totalBurned()).to.equal(burnAmount);
      });

      it("should report circulatingSupply correctly", async function () {
        const burnAmount = ethers.parseUnits("4000", 6);
        await pbUSD.connect(user1).burnAndRedeem(burnAmount, user2.address);
        expect(await pbUSD.circulatingSupply()).to.equal(mintAmount - burnAmount);
      });

      it("should revert if burning zero amount", async function () {
        await expect(
          pbUSD.connect(user1).burnAndRedeem(0, user2.address)
        ).to.be.revertedWithCustomError(pbUSD, "InvalidAmount");
      });

      it("should revert if baseRecipient is zero", async function () {
        await expect(
          pbUSD.connect(user1).burnAndRedeem(ethers.parseUnits("100", 6), ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(pbUSD, "InvalidRecipient");
      });
    });

    // ── Blacklist ───────────────────────────────────────────────
    describe("Blacklist", function () {
      const mintAmount = ethers.parseUnits("1000", 6);

      beforeEach(async function () {
        await pbUSD.connect(minter).mint(user1.address, mintAmount);
      });

      it("should allow compliance to blacklist an account", async function () {
        await pbUSD.connect(compliance).setBlacklist(user1.address, true);
        expect(await pbUSD.isBlacklisted(user1.address)).to.be.true;
      });

      it("should block transfers from blacklisted sender", async function () {
        await pbUSD.connect(compliance).setBlacklist(user1.address, true);
        await expect(
          pbUSD.connect(user1).transfer(user2.address, ethers.parseUnits("100", 6))
        ).to.be.revertedWithCustomError(pbUSD, "SenderBlacklisted");
      });

      it("should block transfers to blacklisted receiver", async function () {
        await pbUSD.connect(compliance).setBlacklist(user2.address, true);
        await expect(
          pbUSD.connect(user1).transfer(user2.address, ethers.parseUnits("100", 6))
        ).to.be.revertedWithCustomError(pbUSD, "RecipientBlacklisted");
      });

      it("should allow removing from blacklist", async function () {
        await pbUSD.connect(compliance).setBlacklist(user1.address, true);
        await pbUSD.connect(compliance).setBlacklist(user1.address, false);
        await pbUSD.connect(user1).transfer(user2.address, ethers.parseUnits("100", 6));
        expect(await pbUSD.balanceOf(user2.address)).to.equal(ethers.parseUnits("100", 6));
      });
    });

    // ── Pause ───────────────────────────────────────────────────
    describe("Pause", function () {
      it("should allow pauser to pause", async function () {
        await pbUSD.connect(pauser).pause();
        expect(await pbUSD.paused()).to.be.true;
      });

      it("should block minting when paused", async function () {
        await pbUSD.connect(pauser).pause();
        await expect(
          pbUSD.connect(minter).mint(user1.address, ethers.parseUnits("100", 6))
        ).to.be.reverted;
      });

      it("should block transfers when paused", async function () {
        await pbUSD.connect(minter).mint(user1.address, ethers.parseUnits("100", 6));
        await pbUSD.connect(pauser).pause();
        await expect(
          pbUSD.connect(user1).transfer(user2.address, ethers.parseUnits("50", 6))
        ).to.be.reverted;
      });

      it("should allow unpausing", async function () {
        await pbUSD.connect(pauser).pause();
        await pbUSD.connect(pauser).unpause();
        expect(await pbUSD.paused()).to.be.false;
      });
    });

    // ── Transfer Fee ────────────────────────────────────────────
    describe("Transfer Fee", function () {
      const mintAmount = ethers.parseUnits("10000", 6);

      beforeEach(async function () {
        await pbUSD.connect(minter).mint(user1.address, mintAmount);
        // Set up fee: 25 bps = 0.25%
        await pbUSD.connect(admin).setFeeCollector(feeCollector.address);
        await pbUSD.connect(admin).setTransferFee(25);
      });

      it("should deduct transfer fee", async function () {
        const transferAmount = ethers.parseUnits("1000", 6);
        const expectedFee = (transferAmount * 25n) / 10000n; // 2.5 pbUSD
        const expectedReceived = transferAmount - expectedFee;

        await pbUSD.connect(user1).transfer(user2.address, transferAmount);

        expect(await pbUSD.balanceOf(user2.address)).to.equal(expectedReceived);
        expect(await pbUSD.balanceOf(feeCollector.address)).to.equal(expectedFee);
      });

      it("should not charge fee for fee-exempt addresses", async function () {
        await pbUSD.connect(admin).setFeeExempt(user1.address, true);
        const transferAmount = ethers.parseUnits("1000", 6);

        await pbUSD.connect(user1).transfer(user2.address, transferAmount);

        expect(await pbUSD.balanceOf(user2.address)).to.equal(transferAmount);
        expect(await pbUSD.balanceOf(feeCollector.address)).to.equal(0);
      });

      it("should not allow fee > MAX_FEE_BPS", async function () {
        await expect(
          pbUSD.connect(admin).setTransferFee(51)
        ).to.be.revertedWithCustomError(pbUSD, "FeeTooHigh");
      });

      it("should allow fee of 0 (no fee)", async function () {
        await pbUSD.connect(admin).setTransferFee(0);
        const transferAmount = ethers.parseUnits("1000", 6);
        await pbUSD.connect(user1).transfer(user2.address, transferAmount);
        expect(await pbUSD.balanceOf(user2.address)).to.equal(transferAmount);
      });
    });

    // ── ERC-3009: TransferWithAuthorization ──────────────────────
    describe("ERC-3009", function () {
      const mintAmount = ethers.parseUnits("10000", 6);

      beforeEach(async function () {
        await pbUSD.connect(minter).mint(user1.address, mintAmount);
      });

      it("should execute transferWithAuthorization", async function () {
        const value = ethers.parseUnits("500", 6);
        const validAfter = 0;
        const latestTime = await time.latest();
        const validBefore = latestTime + 3600;
        const nonce = ethers.randomBytes(32);

        const domain = {
          name: "Protocol Bank USD",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pbUSD.getAddress(),
        };

        const types = {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        };

        const message = {
          from: user1.address,
          to: user2.address,
          value: value,
          validAfter: validAfter,
          validBefore: validBefore,
          nonce: ethers.hexlify(nonce),
        };

        const sig = await user1.signTypedData(domain, types, message);
        const { v, r, s } = ethers.Signature.from(sig);

        await pbUSD
          .connect(admin)
          .transferWithAuthorization(
            user1.address,
            user2.address,
            value,
            validAfter,
            validBefore,
            ethers.hexlify(nonce),
            v,
            r,
            s
          );

        expect(await pbUSD.balanceOf(user2.address)).to.equal(value);
      });

      it("should prevent reuse of authorization nonce", async function () {
        const value = ethers.parseUnits("100", 6);
        const validAfter = 0;
        const latestTime = await time.latest();
        const validBefore = latestTime + 3600;
        const nonce = ethers.randomBytes(32);

        const domain = {
          name: "Protocol Bank USD",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pbUSD.getAddress(),
        };

        const types = {
          TransferWithAuthorization: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
          ],
        };

        const message = {
          from: user1.address,
          to: user2.address,
          value: value,
          validAfter: validAfter,
          validBefore: validBefore,
          nonce: ethers.hexlify(nonce),
        };

        const sig = await user1.signTypedData(domain, types, message);
        const { v, r, s } = ethers.Signature.from(sig);

        // First use: should succeed
        await pbUSD
          .connect(admin)
          .transferWithAuthorization(
            user1.address,
            user2.address,
            value,
            validAfter,
            validBefore,
            ethers.hexlify(nonce),
            v,
            r,
            s
          );

        // Second use: should fail
        await expect(
          pbUSD
            .connect(admin)
            .transferWithAuthorization(
              user1.address,
              user2.address,
              value,
              validAfter,
              validBefore,
              ethers.hexlify(nonce),
              v,
              r,
              s
            )
        ).to.be.revertedWithCustomError(pbUSD, "AuthorizationAlreadyUsed");
      });

      it("should allow cancelAuthorization", async function () {
        const nonce = ethers.randomBytes(32);

        const domain = {
          name: "Protocol Bank USD",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: await pbUSD.getAddress(),
        };

        const types = {
          CancelAuthorization: [
            { name: "authorizer", type: "address" },
            { name: "nonce", type: "bytes32" },
          ],
        };

        const message = {
          authorizer: user1.address,
          nonce: ethers.hexlify(nonce),
        };

        const sig = await user1.signTypedData(domain, types, message);
        const { v, r, s } = ethers.Signature.from(sig);

        await expect(
          pbUSD.connect(user1).cancelAuthorization(ethers.hexlify(nonce), v, r, s)
        )
          .to.emit(pbUSD, "AuthorizationCanceled")
          .withArgs(user1.address, ethers.hexlify(nonce));

        expect(await pbUSD.authorizationState(user1.address, ethers.hexlify(nonce))).to.be.true;
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  //                    TREASURY TESTS
  // ════════════════════════════════════════════════════════════════

  describe("ProtocolBankTreasury", function () {
    // ── Deployment ──────────────────────────────────────────────
    describe("Deployment", function () {
      it("should set USDC address", async function () {
        expect(await treasury.usdc()).to.equal(await mockUSDC.getAddress());
      });

      it("should assign roles correctly", async function () {
        const RELAYER_ROLE = await treasury.RELAYER_ROLE();
        const GUARDIAN_ROLE = await treasury.GUARDIAN_ROLE();
        const DEFAULT_ADMIN_ROLE = await treasury.DEFAULT_ADMIN_ROLE();

        expect(await treasury.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
        expect(await treasury.hasRole(RELAYER_ROLE, relayer.address)).to.be.true;
        expect(await treasury.hasRole(GUARDIAN_ROLE, guardian.address)).to.be.true;
      });

      it("should set daily release cap", async function () {
        expect(await treasury.dailyReleaseCap()).to.equal(DAILY_RELEASE_CAP);
      });
    });

    // ── Deposit ─────────────────────────────────────────────────
    describe("Deposit", function () {
      it("should accept USDC deposits", async function () {
        const amount = ethers.parseUnits("1000", 6);
        await expect(
          treasury.connect(user1).depositToHashKey(amount, user1.address)
        )
          .to.emit(treasury, "DepositForMint");

        expect(await mockUSDC.balanceOf(await treasury.getAddress())).to.equal(amount);
      });

      it("should track totalDeposited", async function () {
        const amount = ethers.parseUnits("5000", 6);
        await treasury.connect(user1).depositToHashKey(amount, user1.address);
        expect(await treasury.totalDeposited()).to.equal(amount);
      });

      it("should revert on zero amount", async function () {
        await expect(
          treasury.connect(user1).depositToHashKey(0, user1.address)
        ).to.be.revertedWithCustomError(treasury, "InvalidAmount");
      });

      it("should revert on zero recipient", async function () {
        await expect(
          treasury.connect(user1).depositToHashKey(ethers.parseUnits("100", 6), ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(treasury, "InvalidRecipient");
      });
    });

    // ── Release ─────────────────────────────────────────────────
    describe("Release", function () {
      const depositAmount = ethers.parseUnits("100000", 6);

      beforeEach(async function () {
        await treasury.connect(user1).depositToHashKey(depositAmount, user1.address);
      });

      it("should release USDC after burn proof", async function () {
        const releaseAmount = ethers.parseUnits("5000", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn_tx_001"));

        const balBefore = await mockUSDC.balanceOf(user2.address);
        await treasury.connect(relayer).releaseFromBurn(user2.address, releaseAmount, burnTxHash);
        const balAfter = await mockUSDC.balanceOf(user2.address);

        expect(balAfter - balBefore).to.equal(releaseAmount);
      });

      it("should prevent double-release with same burnTxHash", async function () {
        const releaseAmount = ethers.parseUnits("1000", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn_tx_002"));

        await treasury.connect(relayer).releaseFromBurn(user2.address, releaseAmount, burnTxHash);

        await expect(
          treasury.connect(relayer).releaseFromBurn(user2.address, releaseAmount, burnTxHash)
        ).to.be.revertedWithCustomError(treasury, "BurnTxAlreadyProcessed");
      });

      it("should enforce daily release cap", async function () {
        const overCap = DAILY_RELEASE_CAP + ethers.parseUnits("1", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn_tx_cap"));

        await expect(
          treasury.connect(relayer).releaseFromBurn(user2.address, overCap, burnTxHash)
        ).to.be.revertedWithCustomError(treasury, "DailyReleaseCapExceeded");
      });

      it("should reset daily release cap on new day", async function () {
        // Deposit more USDC to cover 2 days of releases
        await mockUSDC.mint(user1.address, DAILY_RELEASE_CAP * 2n);
        await mockUSDC.connect(user1).approve(await treasury.getAddress(), DAILY_RELEASE_CAP * 2n);
        await treasury.connect(user1).depositToHashKey(DAILY_RELEASE_CAP * 2n, user1.address);

        // Use up the cap
        const burnHash1 = ethers.keccak256(ethers.toUtf8Bytes("burn_day1"));
        await treasury.connect(relayer).releaseFromBurn(user2.address, DAILY_RELEASE_CAP, burnHash1);

        // Advance to next day
        await time.increase(86400);

        // Should be able to release again
        const burnHash2 = ethers.keccak256(ethers.toUtf8Bytes("burn_day2"));
        await treasury.connect(relayer).releaseFromBurn(user2.address, DAILY_RELEASE_CAP, burnHash2);
      });

      it("should track totalReleased", async function () {
        const releaseAmount = ethers.parseUnits("2000", 6);
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn_tx_track"));
        await treasury.connect(relayer).releaseFromBurn(user2.address, releaseAmount, burnTxHash);
        expect(await treasury.totalReleased()).to.equal(releaseAmount);
      });

      it("should revert if vault has insufficient balance", async function () {
        // Deploy a fresh treasury with no USDC
        const TreasuryFactory = await ethers.getContractFactory("ProtocolBankTreasury");
        const emptyTreasury = await TreasuryFactory.deploy(
          await mockUSDC.getAddress(),
          admin.address,
          relayer.address,
          guardian.address,
          DAILY_RELEASE_CAP,
          EMERGENCY_DELAY
        );

        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn_tx_empty"));
        await expect(
          emptyTreasury
            .connect(relayer)
            .releaseFromBurn(user2.address, ethers.parseUnits("100", 6), burnTxHash)
        ).to.be.revertedWithCustomError(emptyTreasury, "InsufficientVaultBalance");
      });

      it("should only allow RELAYER_ROLE to release", async function () {
        const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("burn_tx_unauth"));
        await expect(
          treasury.connect(user1).releaseFromBurn(user2.address, ethers.parseUnits("100", 6), burnTxHash)
        ).to.be.reverted;
      });
    });

    // ── Emergency Withdrawal ────────────────────────────────────
    describe("Emergency Withdrawal", function () {
      const depositAmount = ethers.parseUnits("50000", 6);

      beforeEach(async function () {
        await treasury.connect(user1).depositToHashKey(depositAmount, user1.address);
      });

      it("should request and execute emergency withdrawal after delay", async function () {
        const amount = ethers.parseUnits("10000", 6);

        const tx = await treasury.connect(guardian).requestEmergencyWithdraw(admin.address, amount);
        const receipt = await tx.wait();

        // Get the request hash from the event
        const event = receipt?.logs.find((log: any) => {
          try {
            return treasury.interface.parseLog({ data: log.data, topics: [...log.topics] })?.name === "EmergencyWithdrawRequested";
          } catch { return false; }
        });
        const parsedEvent = treasury.interface.parseLog({ data: event!.data, topics: [...event!.topics] });
        const requestHash = parsedEvent!.args.requestHash;

        // Should fail before delay
        await expect(
          treasury.connect(guardian).executeEmergencyWithdraw(admin.address, amount, requestHash)
        ).to.be.revertedWithCustomError(treasury, "EmergencyNotReady");

        // Advance time past delay
        await time.increase(EMERGENCY_DELAY + 1);

        // Now should succeed
        const balBefore = await mockUSDC.balanceOf(admin.address);
        await treasury.connect(guardian).executeEmergencyWithdraw(admin.address, amount, requestHash);
        const balAfter = await mockUSDC.balanceOf(admin.address);

        expect(balAfter - balBefore).to.equal(amount);
      });

      it("should allow admin to cancel emergency request", async function () {
        const amount = ethers.parseUnits("5000", 6);
        const tx = await treasury.connect(guardian).requestEmergencyWithdraw(admin.address, amount);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return treasury.interface.parseLog({ data: log.data, topics: [...log.topics] })?.name === "EmergencyWithdrawRequested";
          } catch { return false; }
        });
        const parsedEvent = treasury.interface.parseLog({ data: event!.data, topics: [...event!.topics] });
        const requestHash = parsedEvent!.args.requestHash;

        await treasury.connect(admin).cancelEmergencyWithdraw(requestHash);

        // Should not be executable anymore
        await time.increase(EMERGENCY_DELAY + 1);
        await expect(
          treasury.connect(guardian).executeEmergencyWithdraw(admin.address, amount, requestHash)
        ).to.be.revertedWithCustomError(treasury, "EmergencyRequestNotFound");
      });
    });

    // ── Pause ───────────────────────────────────────────────────
    describe("Pause", function () {
      it("should allow guardian to pause", async function () {
        await treasury.connect(guardian).pause();
        expect(await treasury.paused()).to.be.true;
      });

      it("should block deposits when paused", async function () {
        await treasury.connect(guardian).pause();
        await expect(
          treasury.connect(user1).depositToHashKey(ethers.parseUnits("100", 6), user1.address)
        ).to.be.reverted;
      });

      it("should allow admin to unpause", async function () {
        await treasury.connect(guardian).pause();
        await treasury.connect(admin).unpause();
        expect(await treasury.paused()).to.be.false;
      });
    });

    // ── View Functions ──────────────────────────────────────────
    describe("View Functions", function () {
      it("should report vault balance", async function () {
        const amount = ethers.parseUnits("10000", 6);
        await treasury.connect(user1).depositToHashKey(amount, user1.address);
        expect(await treasury.vaultBalance()).to.equal(amount);
      });

      it("should report net deposited", async function () {
        const deposit = ethers.parseUnits("10000", 6);
        const release = ethers.parseUnits("3000", 6);
        const burnHash = ethers.keccak256(ethers.toUtf8Bytes("burn_net"));

        await treasury.connect(user1).depositToHashKey(deposit, user1.address);
        await treasury.connect(relayer).releaseFromBurn(user2.address, release, burnHash);

        expect(await treasury.netDeposited()).to.equal(deposit - release);
      });

      it("should report remaining daily release", async function () {
        const deposit = ethers.parseUnits("500000", 6);
        const release = ethers.parseUnits("300000", 6);
        const burnHash = ethers.keccak256(ethers.toUtf8Bytes("burn_remaining"));

        await mockUSDC.mint(user1.address, deposit);
        await mockUSDC.connect(user1).approve(await treasury.getAddress(), deposit);
        await treasury.connect(user1).depositToHashKey(deposit, user1.address);
        await treasury.connect(relayer).releaseFromBurn(user2.address, release, burnHash);

        expect(await treasury.remainingDailyRelease()).to.equal(DAILY_RELEASE_CAP - release);
      });

      it("should check if burn is processed", async function () {
        const burnHash = ethers.keccak256(ethers.toUtf8Bytes("burn_check"));
        expect(await treasury.isBurnProcessed(burnHash)).to.be.false;

        const amount = ethers.parseUnits("1000", 6);
        await treasury.connect(user1).depositToHashKey(amount, user1.address);
        await treasury.connect(relayer).releaseFromBurn(user2.address, amount, burnHash);

        expect(await treasury.isBurnProcessed(burnHash)).to.be.true;
      });
    });
  });

  // ════════════════════════════════════════════════════════════════
  //               FULL BRIDGE FLOW (Integration)
  // ════════════════════════════════════════════════════════════════

  describe("Full Bridge Flow", function () {
    it("should complete deposit �?mint �?burn �?release cycle", async function () {
      // Step 1: User deposits USDC into Treasury on Base
      const depositAmount = ethers.parseUnits("10000", 6);
      await treasury.connect(user1).depositToHashKey(depositAmount, user1.address);

      // Step 2: Bridge bot mints pbUSD on HashKey (simulated)
      const mintAmount = ethers.parseUnits("10000", 6); // 18 decimals
      await pbUSD.connect(minter).mint(user1.address, mintAmount);
      expect(await pbUSD.balanceOf(user1.address)).to.equal(mintAmount);

      // Step 3: User burns pbUSD to redeem on Base
      await pbUSD.connect(user1).burnAndRedeem(mintAmount, user1.address);
      expect(await pbUSD.balanceOf(user1.address)).to.equal(0);

      // Step 4: Bridge bot releases USDC from Treasury
      const burnTxHash = ethers.keccak256(ethers.toUtf8Bytes("bridge_burn_001"));
      await treasury.connect(relayer).releaseFromBurn(user1.address, depositAmount, burnTxHash);

      // Verify final state
      expect(await pbUSD.totalMinted()).to.equal(mintAmount);
      expect(await pbUSD.totalBurned()).to.equal(mintAmount);
      expect(await pbUSD.circulatingSupply()).to.equal(0);
      expect(await treasury.totalDeposited()).to.equal(depositAmount);
      expect(await treasury.totalReleased()).to.equal(depositAmount);
    });
  });
});
