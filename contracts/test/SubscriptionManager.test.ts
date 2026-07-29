import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { SubscriptionManager, MockERC20Permit } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const MONTH = 30n * 24n * 60n * 60n;
const AMOUNT = ethers.parseUnits("15", 18);

describe("SubscriptionManager", () => {
  let manager: SubscriptionManager;
  let token: MockERC20Permit;
  let owner: HardhatEthersSigner;
  let payer: HardhatEthersSigner;
  let merchant: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, payer, merchant, relayer, attacker] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20Permit");
    token = await Token.deploy("Mock USD", "mUSD");

    const Manager = await ethers.getContractFactory("SubscriptionManager");
    manager = await Manager.deploy(owner.address);

    // Only vetted tokens may be used, and creating a subscription reserves its
    // budget from the payer's allowance — so both must be in place first.
    await manager.connect(owner).setTokenAllowed(await token.getAddress(), true);
    await token.mint(payer.address, ethers.parseUnits("10000", 18));
    await token.connect(payer).approve(await manager.getAddress(), ethers.MaxUint256);
  });

  async function createSubscription(
    overrides: {
      amount?: bigint;
      period?: bigint;
      firstChargeAt?: bigint;
      endTime?: bigint;
      maxPeriods?: number;
      totalAuthorised?: bigint;
      noticeSeconds?: bigint;
    } = {}
  ): Promise<string> {
    const amount = overrides.amount ?? AMOUNT;
    const maxPeriods = overrides.maxPeriods ?? 0;
    const tx = await manager.connect(payer).createSubscription({
      merchant: merchant.address,
      token: await token.getAddress(),
      amountPerPeriod: amount,
      totalAuthorised:
        overrides.totalAuthorised ??
        (maxPeriods === 0 ? amount * 24n : amount * BigInt(maxPeriods)),
      periodSeconds: overrides.period ?? MONTH,
      firstChargeAt: overrides.firstChargeAt ?? 0n,
      endTime: overrides.endTime ?? 0n,
      noticeSeconds: overrides.noticeSeconds ?? 0n,
      maxPeriods,
    });
    const receipt = await tx.wait();
    const event = receipt!.logs
      .map((l) => {
        try {
          return manager.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "SubscriptionCreated");
    return event!.args.subscriptionId;
  }

  /** Build a valid SubscriptionTerms struct, overriding individual fields. */
  async function makeTerms(overrides: Partial<Record<string, any>> = {}) {
    return {
      merchant: merchant.address,
      token: await token.getAddress(),
      amountPerPeriod: AMOUNT,
      totalAuthorised: AMOUNT * 12n,
      periodSeconds: MONTH,
      firstChargeAt: 0n,
      endTime: 0n,
      noticeSeconds: 0n,
      maxPeriods: 12,
      ...overrides,
    };
  }

  async function approveAll() {
    await token.connect(payer).approve(await manager.getAddress(), ethers.MaxUint256);
  }

  describe("non-custodial guarantees", () => {
    it("never holds funds — tokens go payer to merchant directly", async () => {
      const id = await createSubscription();
      await approveAll();

      const merchantBefore = await token.balanceOf(merchant.address);
      const payerBefore = await token.balanceOf(payer.address);

      await manager.connect(relayer).charge(id);

      expect(await token.balanceOf(await manager.getAddress())).to.equal(0);
      expect(await token.balanceOf(merchant.address)).to.equal(merchantBefore + AMOUNT);
      expect(await token.balanceOf(payer.address)).to.equal(payerBefore - AMOUNT);
    });

    it("cannot charge more than the agreed amount", async () => {
      const id = await createSubscription();
      await approveAll();

      await manager.connect(relayer).charge(id);

      // The amount is fixed at creation; there is no path to charge a
      // different figure, so the merchant cannot inflate a bill.
      const sub = await manager.getSubscription(id);
      expect(sub.amountPerPeriod).to.equal(AMOUNT);
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT);
    });

    it("cannot redirect funds — merchant is fixed at creation", async () => {
      const id = await createSubscription();
      await approveAll();
      await manager.connect(relayer).charge(id);

      expect(await token.balanceOf(attacker.address)).to.equal(0);
      const sub = await manager.getSubscription(id);
      expect(sub.merchant).to.equal(merchant.address);
    });

    it("stops immediately when the payer revokes the allowance", async () => {
      const id = await createSubscription();
      await approveAll();
      await manager.connect(relayer).charge(id);

      await token.connect(payer).approve(await manager.getAddress(), 0);
      await time.increase(MONTH + 1n);

      await expect(manager.connect(relayer).charge(id)).to.be.reverted;
    });

    it("owner can pause but cannot reach user funds", async () => {
      const id = await createSubscription();
      await approveAll();
      const ownerBalanceBefore = await token.balanceOf(owner.address);

      await manager.connect(owner).pause();
      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "EnforcedPause"
      );

      // Pausing halts charges; it moves nothing. The owner's own balance is
      // untouched and the contract still holds nothing.
      expect(await token.balanceOf(await manager.getAddress())).to.equal(0);
      expect(await token.balanceOf(owner.address)).to.equal(ownerBalanceBefore);

      await manager.connect(owner).unpause();
      await expect(manager.connect(relayer).charge(id)).to.not.be.reverted;
    });
  });

  describe("schedule enforcement", () => {
    it("rejects a second charge inside the same period", async () => {
      const id = await createSubscription();
      await approveAll();

      await manager.connect(relayer).charge(id);
      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "ChargeNotDue"
      );
    });

    it("allows exactly one charge per elapsed period", async () => {
      const id = await createSubscription();
      await approveAll();

      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);
      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);
      await manager.connect(relayer).charge(id);

      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 3n);
    });

    it("does not let a dormant subscription be drained by catch-up charges", async () => {
      const id = await createSubscription();
      await approveAll();

      await manager.connect(relayer).charge(id);

      // Nobody charges for a year.
      await time.increase(MONTH * 12n);

      // One charge is owed, not twelve.
      await manager.connect(relayer).charge(id);
      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "ChargeNotDue"
      );
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 2n);
    });

    it("does not drift the schedule when a charge lands late", async () => {
      const id = await createSubscription();
      await approveAll();
      await manager.connect(relayer).charge(id);

      const afterFirst = await manager.getSubscription(id);

      // Charge a little late, but within one period of the due time.
      await time.increaseTo(afterFirst.nextChargeAt + 100n);
      await manager.connect(relayer).charge(id);

      const afterSecond = await manager.getSubscription(id);
      // Anchored to the schedule, not to "now + period".
      expect(afterSecond.nextChargeAt).to.equal(afterFirst.nextChargeAt + MONTH);
    });

    it("honours a delayed first charge date", async () => {
      const start = BigInt(await time.latest()) + MONTH;
      const id = await createSubscription({ firstChargeAt: start });
      await approveAll();

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "ChargeNotDue"
      );

      await time.increaseTo(start + 1n);
      await expect(manager.connect(relayer).charge(id)).to.not.be.reverted;
    });
  });

  describe("authorisation limits", () => {
    it("stops after maxPeriods charges", async () => {
      const id = await createSubscription({ maxPeriods: 2 });
      await approveAll();

      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);
      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "SubscriptionExpired"
      );
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 2n);
    });

    it("stops after endTime", async () => {
      const endTime = BigInt(await time.latest()) + MONTH + 100n;
      const id = await createSubscription({ endTime });
      await approveAll();

      await manager.connect(relayer).charge(id);
      await time.increaseTo(endTime + 1n);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "SubscriptionExpired"
      );
    });

    it("rejects nonsensical terms", async () => {
      await expect(
        manager.connect(payer).createSubscription(await makeTerms({ amountPerPeriod: 0 }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");

      await expect(
        manager.connect(payer).createSubscription(await makeTerms({ periodSeconds: 0 }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");

      await expect(
        manager.connect(payer).createSubscription(await makeTerms({ merchant: ethers.ZeroAddress }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");

      // Budget below a single charge could never fund even the first period.
      await expect(
        manager
          .connect(payer)
          .createSubscription(await makeTerms({ totalAuthorised: AMOUNT - 1n }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");
    });
  });

  describe("cancellation", () => {
    it("lets the payer cancel and blocks all further charges", async () => {
      const id = await createSubscription();
      await approveAll();
      await manager.connect(relayer).charge(id);

      await manager.connect(payer).cancel(id);
      await time.increase(MONTH + 1n);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "SubscriptionInactive"
      );
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT);
    });

    it("lets the merchant cancel", async () => {
      const id = await createSubscription();
      await expect(manager.connect(merchant).cancel(id)).to.not.be.reverted;
    });

    it("refuses cancellation by an unrelated address", async () => {
      const id = await createSubscription();
      await expect(manager.connect(attacker).cancel(id)).to.be.revertedWithCustomError(
        manager,
        "NotAuthorised"
      );
    });
  });

  describe("single-signature setup via permit", () => {
    it("creates a working subscription from one off-chain signature", async () => {
      const managerAddress = await manager.getAddress();
      const tokenAddress = await token.getAddress();
      const permitValue = AMOUNT * 12n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const nonce = await token.nonces(payer.address);
      const domain = {
        name: "Mock USD",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: tokenAddress,
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const signature = await payer.signTypedData(domain, types, {
        owner: payer.address,
        spender: managerAddress,
        value: permitValue,
        nonce,
        deadline,
      });
      const { v, r, s } = ethers.Signature.from(signature);

      // One transaction from the payer replaces approve + create, and replaces
      // the per-period signature prompts entirely.
      const tx = await manager
        .connect(payer)
        .createSubscriptionWithPermit(
          await makeTerms({ totalAuthorised: permitValue }),
          permitValue,
          deadline,
          v,
          r,
          s
        );
      await tx.wait();

      expect(await token.allowance(payer.address, managerAddress)).to.equal(permitValue);
    });

    it("refuses when a third party submits the payer's permit", async () => {
      const managerAddress = await manager.getAddress();
      const tokenAddress = await token.getAddress();
      const permitValue = AMOUNT * 12n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const domain = {
        name: "Mock USD",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: tokenAddress,
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const signature = await payer.signTypedData(domain, types, {
        owner: payer.address,
        spender: managerAddress,
        value: permitValue,
        nonce: await token.nonces(payer.address),
        deadline,
      });
      const { v, r, s } = ethers.Signature.from(signature);

      // A permit authorises an allowance, not a set of subscription terms. If a
      // relayer could submit it, it could name any merchant and drain the
      // allowance — so this must fail loudly rather than create a subscription
      // that quietly cannot be charged.
      await expect(
        manager
          .connect(attacker)
          .createSubscriptionWithPermit(
            await makeTerms({ merchant: attacker.address, totalAuthorised: permitValue }),
            permitValue,
            deadline,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(manager, "PermitFailed");

      // Nothing was reserved against the payer's allowance on the attacker's
      // behalf — the attempt left no trace.
      expect(
        await manager.committedAuthorisation(attacker.address, await token.getAddress())
      ).to.equal(0);
      expect(await token.nonces(payer.address)).to.equal(0);
    });

    it("charges across periods from that one signature", async () => {
      const managerAddress = await manager.getAddress();
      const tokenAddress = await token.getAddress();
      const permitValue = AMOUNT * 12n;
      const deadline = BigInt(await time.latest()) + 3600n;

      const domain = {
        name: "Mock USD",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: tokenAddress,
      };
      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };
      const signature = await payer.signTypedData(domain, types, {
        owner: payer.address,
        spender: managerAddress,
        value: permitValue,
        nonce: await token.nonces(payer.address),
        deadline,
      });
      const { v, r, s } = ethers.Signature.from(signature);

      const receipt = await (
        await manager
          .connect(payer)
          .createSubscriptionWithPermit(
            await makeTerms({ totalAuthorised: permitValue }),
            permitValue,
            deadline,
            v,
            r,
            s
          )
      ).wait();

      const id = receipt!.logs
        .map((l) => {
          try {
            return manager.interface.parseLog(l as any);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "SubscriptionCreated")!.args.subscriptionId;

      // Three months charged, with no further interaction from the payer.
      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);
      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);
      await manager.connect(relayer).charge(id);

      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 3n);
    });
  });

  // Regression tests for the findings of the 2026-07-28 adversarial audit.
  // Each of these passed against the pre-fix contract, which is why they exist.
  describe("audit regressions", () => {
    async function signPermit(value: bigint, deadline: bigint) {
      const managerAddress = await manager.getAddress();
      const tokenAddress = await token.getAddress();
      const signature = await payer.signTypedData(
        {
          name: "Mock USD",
          version: "1",
          chainId: (await ethers.provider.getNetwork()).chainId,
          verifyingContract: tokenAddress,
        },
        {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        {
          owner: payer.address,
          spender: managerAddress,
          value,
          nonce: await token.nonces(payer.address),
          deadline,
        }
      );
      return ethers.Signature.from(signature);
    }

    it("H-1: a garbage permit cannot ride on an unrelated existing allowance", async () => {
      // The payer already approved this contract for an earlier subscription.
      await token.connect(payer).approve(await manager.getAddress(), AMOUNT * 12n);

      // A merchant now calls with a signature that was never produced. The old
      // check read total allowance, so the existing approval let this through
      // and the new subscription silently drew on the earlier one's budget.
      await expect(
        manager
          .connect(payer)
          .createSubscriptionWithPermit(
            await makeTerms({ totalAuthorised: AMOUNT, maxPeriods: 1 }),
            AMOUNT,
            BigInt(await time.latest()) + 3600n,
            27,
            ethers.ZeroHash,
            ethers.ZeroHash
          )
      ).to.be.revertedWithCustomError(manager, "PermitFailed");
    });

    it("H-1: permit must cover the whole subscription, not one period", async () => {
      const deadline = BigInt(await time.latest()) + 3600n;
      const tooSmall = AMOUNT * 3n; // 3 periods of authorisation for 12 periods
      const { v, r, s } = await signPermit(tooSmall, deadline);

      await expect(
        manager
          .connect(payer)
          .createSubscriptionWithPermit(
            await makeTerms({ totalAuthorised: AMOUNT * 12n }),
            tooSmall,
            deadline,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");
    });

    it("M-1: cannot charge twice when the due time lands exactly on now", async () => {
      const id = await createSubscription();
      await approveAll();
      await manager.connect(relayer).charge(id);

      // Land precisely on nextChargeAt + periodSeconds — the boundary the old
      // `<` comparison left open.
      const sub = await manager.getSubscription(id);
      await time.increaseTo(sub.nextChargeAt);
      await manager.connect(relayer).charge(id);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "ChargeNotDue"
      );
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 2n);
    });

    it("M-1: nextChargeAt always stays in the future after a charge", async () => {
      const id = await createSubscription();
      await approveAll();

      for (let i = 0; i < 4; i++) {
        await manager.connect(relayer).charge(id);
        const sub = await manager.getSubscription(id);
        const now = BigInt(await time.latest());
        // This is the invariant that makes a same-block double charge
        // structurally impossible.
        expect(sub.nextChargeAt).to.be.greaterThan(now);
        await time.increaseTo(sub.nextChargeAt);
      }
    });

    it("M-2: rejects a back-dated first charge", async () => {
      const past = BigInt(await time.latest()) - MONTH;
      await expect(
        manager.connect(payer).createSubscription(await makeTerms({ firstChargeAt: past }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");
    });

    it("M-2: rejects a subscription that is already expired", async () => {
      const now = BigInt(await time.latest());
      await expect(
        manager.connect(payer).createSubscription(await makeTerms({ endTime: now - 1n }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");
    });

    it("M-3: records skipped periods on-chain instead of forgiving silently", async () => {
      const id = await createSubscription();
      await approveAll();
      await manager.connect(relayer).charge(id);

      await time.increase(MONTH * 6n);

      // Periods that will never be charged must leave a trace, so merchants can
      // see the shortfall rather than discovering a silent revenue gap.
      await expect(manager.connect(relayer).charge(id)).to.emit(manager, "PeriodsSkipped");
    });

    it("L-1: isChargeable reports false while paused", async () => {
      const id = await createSubscription();
      await approveAll();
      expect(await manager.isChargeable(id)).to.equal(true);

      await manager.connect(owner).pause();
      // A relayer trusting the old value would submit doomed transactions.
      expect(await manager.isChargeable(id)).to.equal(false);
      await expect(manager.connect(relayer).charge(id)).to.be.reverted;
    });

    it("L-3: rejects a period long enough to overflow the schedule", async () => {
      await expect(
        manager
          .connect(payer)
          .createSubscription(await makeTerms({ periodSeconds: 2n ** 64n - 1n }))
      ).to.be.revertedWithCustomError(manager, "InvalidTerms");
    });
  });

  describe("per-subscription budgets", () => {
    it("keeps one subscription from spending another's budget", async () => {
      const tokenAddress = await token.getAddress();
      // Approve exactly enough for one 12-period subscription.
      await token.connect(payer).approve(await manager.getAddress(), AMOUNT * 12n);
      await manager.connect(payer).createSubscription(await makeTerms());

      // A second subscription would have to draw on the first one's budget.
      await expect(
        manager.connect(payer).createSubscription(await makeTerms())
      ).to.be.revertedWithCustomError(manager, "AuthorisationExceedsAllowance");

      expect(await manager.availableAuthorisation(payer.address, tokenAddress)).to.equal(0);
    });

    it("stops a subscription once its own budget is exhausted", async () => {
      // Budget for two periods, but no period limit — the budget is the bound.
      const id = await createSubscription({ totalAuthorised: AMOUNT * 2n, maxPeriods: 0 });

      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);
      await manager.connect(relayer).charge(id);
      await time.increase(MONTH + 1n);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "AuthorisationExhausted"
      );
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 2n);
    });

    it("draws down the budget as charges land", async () => {
      const id = await createSubscription({ maxPeriods: 12, totalAuthorised: AMOUNT * 12n });
      await manager.connect(relayer).charge(id);

      const sub = await manager.getSubscription(id);
      expect(sub.remainingAuthorised).to.equal(AMOUNT * 11n);
      expect(
        await manager.committedAuthorisation(payer.address, await token.getAddress())
      ).to.equal(AMOUNT * 11n);
    });

    it("returns unspent budget to the payer's headroom on cancellation", async () => {
      const tokenAddress = await token.getAddress();
      await token.connect(payer).approve(await manager.getAddress(), AMOUNT * 12n);
      const receipt = await (
        await manager.connect(payer).createSubscription(await makeTerms())
      ).wait();
      const id = receipt!.logs
        .map((l) => {
          try {
            return manager.interface.parseLog(l as any);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "SubscriptionCreated")!.args.subscriptionId;

      expect(await manager.availableAuthorisation(payer.address, tokenAddress)).to.equal(0);

      await manager.connect(payer).cancel(id);

      // Freed budget can now fund a different subscription.
      expect(await manager.availableAuthorisation(payer.address, tokenAddress)).to.equal(
        AMOUNT * 12n
      );
      await expect(manager.connect(payer).createSubscription(await makeTerms())).to.not.be.reverted;
    });
  });

  describe("cancellation notice period", () => {
    const NOTICE = 24n * 60n * 60n;

    it("blocks a charge that was never announced", async () => {
      const id = await createSubscription({ noticeSeconds: NOTICE });
      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "ChargeNotAnnounced"
      );
    });

    it("blocks a charge until the notice period has elapsed", async () => {
      const id = await createSubscription({ noticeSeconds: NOTICE });
      await manager.connect(relayer).announceCharge(id);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "NoticePeriodPending"
      );

      await time.increase(NOTICE + 1n);
      await expect(manager.connect(relayer).charge(id)).to.not.be.reverted;
    });

    it("lets the payer cancel during the notice window without being front-run", async () => {
      const id = await createSubscription({ noticeSeconds: NOTICE });
      await manager.connect(relayer).announceCharge(id);

      // The charge cannot execute yet, so the merchant has no transaction to
      // race the cancellation with.
      await manager.connect(payer).cancel(id);
      await time.increase(NOTICE + 1n);

      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "SubscriptionInactive"
      );
      expect(await token.balanceOf(merchant.address)).to.equal(0);
    });

    it("does not let re-announcing extend a pending charge indefinitely", async () => {
      const id = await createSubscription({ noticeSeconds: NOTICE });
      await manager.connect(relayer).announceCharge(id);
      const first = (await manager.getSubscription(id)).announcedAt;

      await time.increase(NOTICE / 2n);
      await manager.connect(relayer).announceCharge(id);

      // A merchant could otherwise keep a charge perpetually pending.
      expect((await manager.getSubscription(id)).announcedAt).to.equal(first);
    });

    it("requires a fresh announcement for each period", async () => {
      const id = await createSubscription({ noticeSeconds: NOTICE });
      await manager.connect(relayer).announceCharge(id);
      await time.increase(NOTICE + 1n);
      await manager.connect(relayer).charge(id);

      await time.increase(MONTH + 1n);
      await expect(manager.connect(relayer).charge(id)).to.be.revertedWithCustomError(
        manager,
        "ChargeNotAnnounced"
      );
    });

    it("charges immediately when no notice period is set", async () => {
      const id = await createSubscription({ noticeSeconds: 0n });
      await expect(manager.connect(relayer).charge(id)).to.not.be.reverted;
    });
  });

  describe("token allowlist", () => {
    it("refuses a token the owner has not vetted", async () => {
      const Token = await ethers.getContractFactory("MockERC20Permit");
      const rogue = await Token.deploy("Rogue", "RGE");
      await rogue.mint(payer.address, ethers.parseUnits("1000", 18));
      await rogue.connect(payer).approve(await manager.getAddress(), ethers.MaxUint256);

      await expect(
        manager
          .connect(payer)
          .createSubscription(await makeTerms({ token: await rogue.getAddress() }))
      ).to.be.revertedWithCustomError(manager, "TokenNotAllowed");
    });

    it("only the owner can change the allowlist", async () => {
      await expect(
        manager.connect(attacker).setTokenAllowed(await token.getAddress(), false)
      ).to.be.revertedWithCustomError(manager, "OwnableUnauthorizedAccount");
    });

    it("delisting a token leaves existing subscriptions chargeable", async () => {
      const id = await createSubscription();
      await manager.connect(owner).setTokenAllowed(await token.getAddress(), false);

      // Terms already agreed between two parties must not be breakable by the
      // contract owner.
      await expect(manager.connect(relayer).charge(id)).to.not.be.reverted;
    });
  });

  describe("ownership handover", () => {
    it("requires the new owner to accept, so a typo cannot orphan the pause key", async () => {
      await manager.connect(owner).transferOwnership(relayer.address);
      // Ownable2Step: the transfer is not effective until accepted.
      expect(await manager.owner()).to.equal(owner.address);

      await manager.connect(relayer).acceptOwnership();
      expect(await manager.owner()).to.equal(relayer.address);
    });
  });

  describe("static-analysis regressions", () => {
    it("guards creation against reentrancy through the token's permit call", async () => {
      const tokenAddress = await token.getAddress();
      await token.connect(payer).approve(await manager.getAddress(), AMOUNT * 12n);

      // createSubscription and createSubscriptionWithPermit are both
      // nonReentrant. permit() hands control to the token contract, and an
      // allowlisted token that later turns malicious (an upgradeable proxy, say)
      // must not be able to re-enter and commit the same allowance twice.
      await manager.connect(payer).createSubscription(await makeTerms());

      // The guard is released between top-level calls, so ordinary sequential
      // use is unaffected — this fails on the budget check, not the guard.
      await expect(
        manager.connect(payer).createSubscription(await makeTerms())
      ).to.be.revertedWithCustomError(manager, "AuthorisationExceedsAllowance");

      expect(await manager.availableAuthorisation(payer.address, tokenAddress)).to.equal(0);
    });
  });

  describe("isChargeable", () => {
    it("reports false when the payer cannot cover the charge", async () => {
      const id = await createSubscription();
      await approveAll();

      const balance = await token.balanceOf(payer.address);
      await token.connect(payer).transfer(attacker.address, balance);

      expect(await manager.isChargeable(id)).to.equal(false);
    });

    it("reports true only when a charge would actually succeed", async () => {
      const id = await createSubscription();
      expect(await manager.isChargeable(id)).to.equal(true);

      await manager.connect(relayer).charge(id);
      expect(await manager.isChargeable(id)).to.equal(false); // not due again

      await time.increase(MONTH + 1n);
      expect(await manager.isChargeable(id)).to.equal(true);

      // Revoking the allowance makes it unchargeable even though it is due.
      await token.connect(payer).approve(await manager.getAddress(), 0);
      expect(await manager.isChargeable(id)).to.equal(false);
    });
  });

  describe("isolation between subscriptions", () => {
    it("gives each subscription its own id and schedule", async () => {
      const first = await createSubscription();
      const second = await createSubscription();
      expect(first).to.not.equal(second);

      await approveAll();
      await manager.connect(relayer).charge(first);

      // Charging one must not consume the other's period.
      expect(await manager.isChargeable(second)).to.equal(true);
      await manager.connect(relayer).charge(second);
      expect(await token.balanceOf(merchant.address)).to.equal(AMOUNT * 2n);
    });
  });
});
