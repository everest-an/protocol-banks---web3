import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SessionKeyValidator } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("SessionKeyValidator", function () {
  let sessionKeyValidator: SessionKeyValidator;
  let owner: HardhatEthersSigner;
  let sessionKeySigner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let targetContract: HardhatEthersSigner;
  let token1: HardhatEthersSigner;
  let token2: HardhatEthersSigner;

  const ONE_HOUR = 60 * 60;
  const ONE_DAY = 24 * ONE_HOUR;
  const ONE_WEEK = 7 * ONE_DAY;
  const ONE_ETH = ethers.parseEther("1");
  const TEN_ETH = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, sessionKeySigner, user, targetContract, token1, token2] = await ethers.getSigners();

    const SessionKeyValidatorFactory = await ethers.getContractFactory("SessionKeyValidator");
    sessionKeyValidator = await SessionKeyValidatorFactory.deploy();
    await sessionKeyValidator.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await sessionKeyValidator.owner()).to.equal(owner.address);
    });

    it("Should have correct default configuration", async function () {
      expect(await sessionKeyValidator.minSessionDuration()).to.equal(ONE_HOUR);
      expect(await sessionKeyValidator.maxSessionDuration()).to.equal(30 * ONE_DAY);
      expect(await sessionKeyValidator.maxAllowedTokens()).to.equal(20);
      expect(await sessionKeyValidator.maxAllowedTargets()).to.equal(50);
    });

    it("Should have zero initial statistics", async function () {
      expect(await sessionKeyValidator.totalSessionsCreated()).to.equal(0);
      expect(await sessionKeyValidator.totalBudgetAllocated()).to.equal(0);
      expect(await sessionKeyValidator.totalBudgetUsed()).to.equal(0);
    });
  });

  describe("createSessionKey", function () {
    it("Should create a session key successfully", async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,          // maxBudget
        ONE_ETH,          // maxSingleTx
        ONE_WEEK,         // duration
        [],               // allowedTokens
        []                // allowedTargets
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Check event
      await expect(tx).to.emit(sessionKeyValidator, "SessionKeyCreated");

      // Check statistics
      expect(await sessionKeyValidator.totalSessionsCreated()).to.equal(1);
      expect(await sessionKeyValidator.totalBudgetAllocated()).to.equal(TEN_ETH);
    });

    it("Should reject invalid session key address", async function () {
      await expect(
        sessionKeyValidator.createSessionKey(
          ethers.ZeroAddress,
          TEN_ETH,
          ONE_ETH,
          ONE_WEEK,
          [],
          []
        )
      ).to.be.revertedWith("Invalid session key");
    });

    it("Should reject self as session key", async function () {
      await expect(
        sessionKeyValidator.createSessionKey(
          owner.address,
          TEN_ETH,
          ONE_ETH,
          ONE_WEEK,
          [],
          []
        )
      ).to.be.revertedWith("Session key cannot be owner");
    });

    it("Should reject zero budget", async function () {
      await expect(
        sessionKeyValidator.createSessionKey(
          sessionKeySigner.address,
          0,
          ONE_ETH,
          ONE_WEEK,
          [],
          []
        )
      ).to.be.revertedWith("Budget must be positive");
    });

    it("Should reject maxSingleTx greater than maxBudget", async function () {
      await expect(
        sessionKeyValidator.createSessionKey(
          sessionKeySigner.address,
          ONE_ETH,
          TEN_ETH,  // maxSingleTx > maxBudget
          ONE_WEEK,
          [],
          []
        )
      ).to.be.revertedWith("Invalid single tx limit");
    });

    it("Should reject duration shorter than minimum", async function () {
      await expect(
        sessionKeyValidator.createSessionKey(
          sessionKeySigner.address,
          TEN_ETH,
          ONE_ETH,
          60,  // 1 minute < 1 hour minimum
          [],
          []
        )
      ).to.be.revertedWith("Invalid duration");
    });

    it("Should reject duration longer than maximum", async function () {
      await expect(
        sessionKeyValidator.createSessionKey(
          sessionKeySigner.address,
          TEN_ETH,
          ONE_ETH,
          365 * ONE_DAY,  // 1 year > 30 days maximum
          [],
          []
        )
      ).to.be.revertedWith("Invalid duration");
    });

    it("Should reject reusing an active session key", async function () {
      await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [],
        []
      );

      await expect(
        sessionKeyValidator.createSessionKey(
          sessionKeySigner.address,  // Same session key
          TEN_ETH,
          ONE_ETH,
          ONE_WEEK,
          [],
          []
        )
      ).to.be.revertedWith("Session key already used");
    });

    it("Should create session with token whitelist", async function () {
      const allowedTokens = [token1.address, token2.address];

      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        allowedTokens,
        []
      );

      const receipt = await tx.wait();
      const sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
      const tokens = await sessionKeyValidator.getAllowedTokens(sessionId);

      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(token1.address);
      expect(tokens[1]).to.equal(token2.address);
    });
  });

  describe("validateAndRecord", function () {
    let sessionId: string;

    beforeEach(async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [],
        []
      );
      await tx.wait();
      sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
    });

    it("Should validate and record usage successfully", async function () {
      const amount = ethers.parseEther("0.5");
      const session = await sessionKeyValidator.getSessionKey(sessionId);
      const usedBudget = session.usedBudget;

      // Create signature
      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
        [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, usedBudget]
      );
      const signature = await sessionKeySigner.signMessage(ethers.getBytes(messageHash));

      const tx = await sessionKeyValidator.validateAndRecord(
        sessionId,
        amount,
        ethers.ZeroAddress,
        targetContract.address,
        signature
      );

      await expect(tx).to.emit(sessionKeyValidator, "SessionKeyUsed");

      // Check updated budget
      const updatedSession = await sessionKeyValidator.getSessionKey(sessionId);
      expect(updatedSession.usedBudget).to.equal(amount);
    });

    it("Should reject exceeding single tx limit", async function () {
      const amount = ethers.parseEther("2");  // > 1 ETH maxSingleTx
      const session = await sessionKeyValidator.getSessionKey(sessionId);

      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
        [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, session.usedBudget]
      );
      const signature = await sessionKeySigner.signMessage(ethers.getBytes(messageHash));

      await expect(
        sessionKeyValidator.validateAndRecord(
          sessionId,
          amount,
          ethers.ZeroAddress,
          targetContract.address,
          signature
        )
      ).to.be.revertedWith("Exceeds single tx limit");
    });

    it("Should reject exceeding total budget", async function () {
      // First use most of the budget
      for (let i = 0; i < 9; i++) {
        const amount = ONE_ETH;
        const session = await sessionKeyValidator.getSessionKey(sessionId);

        const messageHash = ethers.solidityPackedKeccak256(
          ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
          [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, session.usedBudget]
        );
        const signature = await sessionKeySigner.signMessage(ethers.getBytes(messageHash));

        await sessionKeyValidator.validateAndRecord(
          sessionId,
          amount,
          ethers.ZeroAddress,
          targetContract.address,
          signature
        );
      }

      // Try to exceed budget
      const amount = ethers.parseEther("2");  // Would exceed 10 ETH total
      const session = await sessionKeyValidator.getSessionKey(sessionId);

      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
        [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, session.usedBudget]
      );
      const signature = await sessionKeySigner.signMessage(ethers.getBytes(messageHash));

      await expect(
        sessionKeyValidator.validateAndRecord(
          sessionId,
          amount,
          ethers.ZeroAddress,
          targetContract.address,
          signature
        )
      ).to.be.revertedWith("Exceeds budget");
    });

    it("Should reject invalid signature", async function () {
      const amount = ethers.parseEther("0.5");
      const session = await sessionKeyValidator.getSessionKey(sessionId);

      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
        [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, session.usedBudget]
      );
      // Sign with wrong signer
      const signature = await user.signMessage(ethers.getBytes(messageHash));

      await expect(
        sessionKeyValidator.validateAndRecord(
          sessionId,
          amount,
          ethers.ZeroAddress,
          targetContract.address,
          signature
        )
      ).to.be.revertedWith("Invalid signature");
    });
  });

  describe("freezeSessionKey / unfreezeSessionKey", function () {
    let sessionId: string;

    beforeEach(async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [],
        []
      );
      await tx.wait();
      sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
    });

    it("Should freeze session key", async function () {
      const tx = await sessionKeyValidator.freezeSessionKey(sessionId, "Suspicious activity");
      await expect(tx).to.emit(sessionKeyValidator, "SessionKeyFrozen");

      const session = await sessionKeyValidator.getSessionKey(sessionId);
      expect(session.isFrozen).to.be.true;
    });

    it("Should reject freeze from non-owner", async function () {
      await expect(
        sessionKeyValidator.connect(user).freezeSessionKey(sessionId, "Suspicious activity")
      ).to.be.revertedWith("Not session owner");
    });

    it("Should unfreeze session key", async function () {
      await sessionKeyValidator.freezeSessionKey(sessionId, "Suspicious activity");

      const tx = await sessionKeyValidator.unfreezeSessionKey(sessionId);
      await expect(tx).to.emit(sessionKeyValidator, "SessionKeyUnfrozen");

      const session = await sessionKeyValidator.getSessionKey(sessionId);
      expect(session.isFrozen).to.be.false;
    });

    it("Should reject operations on frozen session", async function () {
      await sessionKeyValidator.freezeSessionKey(sessionId, "Suspicious activity");

      const amount = ethers.parseEther("0.5");
      const session = await sessionKeyValidator.getSessionKey(sessionId);

      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
        [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, session.usedBudget]
      );
      const signature = await sessionKeySigner.signMessage(ethers.getBytes(messageHash));

      await expect(
        sessionKeyValidator.validateAndRecord(
          sessionId,
          amount,
          ethers.ZeroAddress,
          targetContract.address,
          signature
        )
      ).to.be.revertedWith("Session is frozen");
    });
  });

  describe("revokeSessionKey", function () {
    let sessionId: string;

    beforeEach(async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [],
        []
      );
      await tx.wait();
      sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
    });

    it("Should revoke session key", async function () {
      const tx = await sessionKeyValidator.revokeSessionKey(sessionId);
      await expect(tx).to.emit(sessionKeyValidator, "SessionKeyRevoked");

      const session = await sessionKeyValidator.getSessionKey(sessionId);
      expect(session.isActive).to.be.false;
    });

    it("Should allow reusing revoked session key address", async function () {
      await sessionKeyValidator.revokeSessionKey(sessionId);

      // Should now be able to create new session with same key
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [],
        []
      );
      await expect(tx).to.emit(sessionKeyValidator, "SessionKeyCreated");
    });
  });

  describe("topUpBudget", function () {
    let sessionId: string;

    beforeEach(async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [],
        []
      );
      await tx.wait();
      sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
    });

    it("Should top up budget", async function () {
      const additionalBudget = ethers.parseEther("5");
      const tx = await sessionKeyValidator.topUpBudget(sessionId, additionalBudget);

      await expect(tx).to.emit(sessionKeyValidator, "BudgetTopUp");

      const session = await sessionKeyValidator.getSessionKey(sessionId);
      expect(session.maxBudget).to.equal(TEN_ETH + additionalBudget);
    });
  });

  describe("Session expiration", function () {
    let sessionId: string;

    beforeEach(async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_HOUR,  // Short duration for testing
        [],
        []
      );
      await tx.wait();
      sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
    });

    it("Should reject operations on expired session", async function () {
      // Fast forward time
      await time.increase(ONE_HOUR + 1);

      const amount = ethers.parseEther("0.5");

      const messageHash = ethers.solidityPackedKeccak256(
        ["bytes32", "uint256", "address", "address", "uint256", "uint256"],
        [sessionId, amount, ethers.ZeroAddress, targetContract.address, 31337n, 0n]
      );
      const signature = await sessionKeySigner.signMessage(ethers.getBytes(messageHash));

      await expect(
        sessionKeyValidator.validateAndRecord(
          sessionId,
          amount,
          ethers.ZeroAddress,
          targetContract.address,
          signature
        )
      ).to.be.revertedWith("Session expired");
    });

    it("Should report zero remaining budget for expired session", async function () {
      await time.increase(ONE_HOUR + 1);

      const remaining = await sessionKeyValidator.getRemainingBudget(sessionId);
      expect(remaining).to.equal(0);
    });
  });

  describe("View functions", function () {
    let sessionId: string;

    beforeEach(async function () {
      const tx = await sessionKeyValidator.createSessionKey(
        sessionKeySigner.address,
        TEN_ETH,
        ONE_ETH,
        ONE_WEEK,
        [token1.address],
        [targetContract.address]
      );
      await tx.wait();
      sessionId = await sessionKeyValidator.sessionKeyToId(sessionKeySigner.address);
    });

    it("Should return correct session details", async function () {
      const session = await sessionKeyValidator.getSessionKey(sessionId);
      expect(session.owner).to.equal(owner.address);
      expect(session.sessionKey).to.equal(sessionKeySigner.address);
      expect(session.maxBudget).to.equal(TEN_ETH);
      expect(session.usedBudget).to.equal(0);
      expect(session.remainingBudget).to.equal(TEN_ETH);
      expect(session.isActive).to.be.true;
      expect(session.isFrozen).to.be.false;
    });

    it("Should return owner sessions", async function () {
      const sessions = await sessionKeyValidator.getOwnerSessions(owner.address);
      expect(sessions.length).to.equal(1);
      expect(sessions[0]).to.equal(sessionId);
    });

    it("Should correctly check session validity", async function () {
      expect(await sessionKeyValidator.isSessionValid(sessionId)).to.be.true;

      await sessionKeyValidator.freezeSessionKey(sessionId, "Test");
      expect(await sessionKeyValidator.isSessionValid(sessionId)).to.be.false;
    });
  });

  describe("Admin functions", function () {
    it("Should update session duration limits", async function () {
      await sessionKeyValidator.setSessionDurationLimits(30 * 60, 60 * ONE_DAY);

      expect(await sessionKeyValidator.minSessionDuration()).to.equal(30 * 60);
      expect(await sessionKeyValidator.maxSessionDuration()).to.equal(60 * ONE_DAY);
    });

    it("Should reject invalid duration limits", async function () {
      await expect(
        sessionKeyValidator.setSessionDurationLimits(ONE_DAY, ONE_HOUR)  // min > max
      ).to.be.revertedWith("Invalid limits");
    });

    it("Should update whitelist limits", async function () {
      await sessionKeyValidator.setWhitelistLimits(50, 100);

      expect(await sessionKeyValidator.maxAllowedTokens()).to.equal(50);
      expect(await sessionKeyValidator.maxAllowedTargets()).to.equal(100);
    });

    it("Should reject admin calls from non-owner", async function () {
      await expect(
        sessionKeyValidator.connect(user).setSessionDurationLimits(ONE_HOUR, ONE_DAY)
      ).to.be.revertedWithCustomError(sessionKeyValidator, "OwnableUnauthorizedAccount");
    });
  });
});
