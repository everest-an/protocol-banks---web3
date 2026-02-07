import { expect } from "chai";
import { ethers } from "hardhat";
import { ProtocolBankTreasury, ProtocolBankUSD, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Protocol Bank pbUSD System", function () {
  let treasury: ProtocolBankTreasury;
  let pbUSD: ProtocolBankUSD;
  let usdc: MockERC20;
  
  let owner: SignerWithAddress;
  let relayerWrapper: SignerWithAddress;
  let user: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const MINT_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC
  const DEPOSIT_AMOUNT = ethers.parseUnits("100", 6); // 100 USDC

  before(async function () {
    [owner, relayerWrapper, user, otherAccount] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy Mock USDC", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      usdc = await MockERC20Factory.deploy("USD Coin", "USDC");
      // USDC usually has 6 decimals, but OpenZeppelin ERC20 defaults to 18. 
      // mocking 18 here for simplicity unless we override decimals, 
      // but let's assume standard ERC20 behavior for now or override in Mock if needed.
      // Actually standard USDC is 6. TokenAmount usually accounts for decimals.
      // For this test, 18 decimals is fine as long as we are consistent.
    });

    it("Should deploy Treasury on 'Base'", async function () {
      const TreasuryFactory = await ethers.getContractFactory("ProtocolBankTreasury");
      treasury = await TreasuryFactory.deploy(await usdc.getAddress(), owner.address); // Owner is admin
    });

    it("Should deploy pbUSD on 'HashKey'", async function () {
      const PbUSDFactory = await ethers.getContractFactory("ProtocolBankUSD");
      // admin, minter, pauser, compliance
      pbUSD = await PbUSDFactory.deploy(owner.address, relayerWrapper.address, owner.address, owner.address); 
    });

    it("Should grant roles correctly", async function () {
      const MINTER_ROLE = await pbUSD.MINTER_ROLE();
      expect(await pbUSD.hasRole(MINTER_ROLE, relayerWrapper.address)).to.be.true;
      
      const RELAYER_ROLE = await treasury.RELAYER_ROLE();
      // Owner was given RELAYER role in constructor, but we want the 'relayerWrapper' (bot) to have it too?
      // In constructor: _grantRole(RELAYER_ROLE, _admin);
      // Let's grant it to the bot as well.
      await treasury.grantRole(RELAYER_ROLE, relayerWrapper.address);
      expect(await treasury.hasRole(RELAYER_ROLE, relayerWrapper.address)).to.be.true;
    });
  });

  describe("Step 1: Deposit on Base", function () {
    it("Should allow user to deposit USDC", async function () {
      // 1. Give User some USDC
      await usdc.transfer(user.address, MINT_AMOUNT);
      
      // 2. User approves Treasury
      await usdc.connect(user).approve(await treasury.getAddress(), DEPOSIT_AMOUNT);

      // 3. User Deposits
      await expect(treasury.connect(user).depositToHashKey(DEPOSIT_AMOUNT, user.address))
        .to.emit(treasury, "DepositedToHashKey")
        .withArgs(user.address, DEPOSIT_AMOUNT, user.address, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1)); 
        // Timestamp check is tricky, ignoring exact arg check often easier or fetch block.
        // Simplified check:
    });

    it("Should lock USDC in Treasury", async function () {
      const balance = await usdc.balanceOf(await treasury.getAddress());
      expect(balance).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Step 2: Mint on HashKey", function () {
    it("Should allow Relayer to mint pbUSD", async function () {
      // Relayer sees the event from Step 1 and mints on HashKey
      await expect(pbUSD.connect(relayerWrapper).mint(user.address, DEPOSIT_AMOUNT))
        .to.emit(pbUSD, "Transfer")
        .withArgs(ethers.ZeroAddress, user.address, DEPOSIT_AMOUNT);
    });

    it("Should update user pbUSD balance", async function () {
      expect(await pbUSD.balanceOf(user.address)).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("Step 3: Burn on HashKey (Exit to Base)", function () {
    it("Should allow user to burn pbUSD", async function () {
      const BURN_AMOUNT = DEPOSIT_AMOUNT / 2n;
      
      await expect(pbUSD.connect(user).burnAndRedeem(BURN_AMOUNT, user.address))
        .to.emit(pbUSD, "RedeemRequested");
        
      expect(await pbUSD.balanceOf(user.address)).to.equal(DEPOSIT_AMOUNT - BURN_AMOUNT);
    });
  });

  describe("Step 4: Release on Base", function () {
    it("Should allow Relayer to release USDC", async function () {
      const RELEASE_AMOUNT = DEPOSIT_AMOUNT / 2n;
      const FAKE_TX_HASH = ethers.keccak256(ethers.toUtf8Bytes("tx_hash_1"));

      // Relayer calls release
      await expect(treasury.connect(relayerWrapper).releaseFromBurn(user.address, RELEASE_AMOUNT, FAKE_TX_HASH))
        .to.emit(treasury, "ReleasedFromBurn")
        .withArgs(user.address, RELEASE_AMOUNT, FAKE_TX_HASH, await ethers.provider.getBlock("latest").then(b => b!.timestamp + 1));
    });

    it("Should prevent double spending (replaying same burn hash)", async function () {
      const RELEASE_AMOUNT = DEPOSIT_AMOUNT / 2n;
      const FAKE_TX_HASH = ethers.keccak256(ethers.toUtf8Bytes("tx_hash_1"));

      await expect(
        treasury.connect(relayerWrapper).releaseFromBurn(user.address, RELEASE_AMOUNT, FAKE_TX_HASH)
      ).to.be.revertedWith("Tx already processed");
    });

    it("User should have received USDC back", async function () {
      const RELEASE_AMOUNT = DEPOSIT_AMOUNT / 2n;
      // Start: 1000. Deposit 100 -> 900. Release 50 -> 950.
      expect(await usdc.balanceOf(user.address)).to.equal(MINT_AMOUNT - DEPOSIT_AMOUNT + RELEASE_AMOUNT);
    });
  });

  describe("Security: Pausing & Blacklist", function () {
    it("Should allow Pauser to pause pbUSD transfers", async function () {
      await pbUSD.connect(owner).pause();
      
      await expect(
        pbUSD.connect(user).burnAndRedeem(100n, user.address)
      ).to.be.revertedWithCustomError(pbUSD, "EnforcedPause");
      
      await pbUSD.connect(owner).unpause();
    });

    it("Should allow Compliance to blacklist user", async function () {
        await pbUSD.connect(owner).setBlacklist(user.address, true);

        await expect(
            pbUSD.connect(user).transfer(otherAccount.address, 100n)
        ).to.be.revertedWith("Sender is blacklisted");

         await expect(
            pbUSD.connect(otherAccount).transfer(user.address, 100n)
        ).to.be.revertedWith("Recipient is blacklisted");
    });
  });
});
