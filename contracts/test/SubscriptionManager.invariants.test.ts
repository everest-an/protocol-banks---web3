import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { SubscriptionManager, MockERC20Permit } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * Invariant tests — properties that must hold after ANY sequence of operations.
 *
 * Stands in for the fuzzing layer (Echidna) that could not be run on this
 * machine: random call sequences are generated here and every invariant is
 * re-checked after each step. The generator is seeded, so a failure reproduces
 * exactly rather than appearing intermittently.
 *
 * The invariants are the properties the contract's safety actually rests on. If
 * one of these can be broken, funds or authorisation accounting are wrong —
 * regardless of whether any individual unit test still passes.
 */

const MONTH = 30n * 24n * 60n * 60n;
const AMOUNT = ethers.parseUnits("15", 18);

/** Deterministic PRNG so a failing sequence can be replayed from its seed. */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

describe("SubscriptionManager invariants", () => {
  let manager: SubscriptionManager;
  let token: MockERC20Permit;
  let owner: HardhatEthersSigner;
  let payer: HardhatEthersSigner;
  let merchant: HardhatEthersSigner;
  let relayer: HardhatEthersSigner;

  let managerAddress: string;
  let tokenAddress: string;

  /** Every subscription id created during a run. */
  let created: string[];

  /**
   * How often each operation actually succeeded.
   *
   * A fuzz run where every operation reverts would satisfy every invariant
   * while testing nothing, so each run asserts it reached these states.
   */
  let hits: { charges: number; cancels: number; announces: number };

  beforeEach(async () => {
    [owner, payer, merchant, relayer] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20Permit");
    token = await Token.deploy("Mock USD", "mUSD");
    tokenAddress = await token.getAddress();

    const Manager = await ethers.getContractFactory("SubscriptionManager");
    manager = await Manager.deploy(owner.address);
    managerAddress = await manager.getAddress();

    await manager.connect(owner).setTokenAllowed(tokenAddress, true);
    await token.mint(payer.address, ethers.parseUnits("100000", 18));
    await token.connect(payer).approve(managerAddress, ethers.parseUnits("100000", 18));

    created = [];
    hits = { charges: 0, cancels: 0, announces: 0 };
  });

  /**
   * Re-check every invariant. Called after each generated operation.
   */
  async function checkInvariants(step: string) {
    // 1. The contract is never a fund holder. This is the whole basis of the
    //    non-custodial claim: if a balance ever accrues here, funds are at risk
    //    from a bug in this contract rather than only from the payer's own
    //    allowance.
    expect(await token.balanceOf(managerAddress), `${step}: contract holds funds`).to.equal(0);

    // 2. Committed authorisation equals the sum of what active subscriptions
    //    still have budgeted. If these drift, either a subscription can spend
    //    budget it never reserved, or headroom is lost forever.
    let sumRemaining = 0n;
    for (const id of created) {
      const sub = await manager.getSubscription(id);
      sumRemaining += sub.remainingAuthorised;
    }
    const committed = await manager.committedAuthorisation(payer.address, tokenAddress);
    expect(committed, `${step}: committed != sum(remainingAuthorised)`).to.equal(sumRemaining);

    // 3. Committed authorisation never exceeds the allowance backing it.
    const allowance = await token.allowance(payer.address, managerAddress);
    expect(committed <= allowance, `${step}: committed ${committed} > allowance ${allowance}`).to
      .be.true;

    const now = BigInt(await time.latest());

    for (const id of created) {
      const sub = await manager.getSubscription(id);

      // 4. A cancelled subscription holds no budget and can never charge again.
      if (sub.cancelled) {
        expect(sub.remainingAuthorised, `${step}: cancelled sub retains budget`).to.equal(0);
        expect(await manager.isChargeable(id), `${step}: cancelled sub chargeable`).to.equal(false);
      }

      // 5. A subscription never charges more times than it was authorised for.
      if (sub.maxPeriods !== 0n) {
        expect(
          sub.periodsCharged <= sub.maxPeriods,
          `${step}: periodsCharged ${sub.periodsCharged} > maxPeriods ${sub.maxPeriods}`
        ).to.be.true;
      }

      // (The "next charge is in the future" property is asserted immediately
      //  after each charge in tryCharge — it is only true at that instant. Time
      //  moves on afterwards and a due subscription legitimately has
      //  nextChargeAt in the past.)

      // 6. Budget never exceeds what the terms could ever spend.
      if (sub.maxPeriods !== 0n) {
        const maxSpend = sub.amountPerPeriod * sub.maxPeriods;
        expect(
          sub.remainingAuthorised <= maxSpend,
          `${step}: remaining ${sub.remainingAuthorised} > max spend ${maxSpend}`
        ).to.be.true;
      }
    }
  }

  async function tryCreate(rng: () => number): Promise<void> {
    const maxPeriods = 1 + Math.floor(rng() * 6);
    const totalAuthorised = AMOUNT * BigInt(maxPeriods);
    const noticeSeconds = rng() < 0.5 ? 0n : BigInt(Math.floor(rng() * 3 + 1)) * 86400n;

    try {
      const tx = await manager.connect(payer).createSubscription({
        merchant: merchant.address,
        token: tokenAddress,
        amountPerPeriod: AMOUNT,
        totalAuthorised,
        periodSeconds: MONTH,
        firstChargeAt: 0n,
        endTime: 0n,
        noticeSeconds,
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
      if (event) created.push(event.args.subscriptionId);
    } catch {
      // Rejected creations (budget exceeded, etc.) are valid outcomes — the
      // invariants must hold either way.
    }
  }

  async function tryCharge(rng: () => number): Promise<void> {
    if (created.length === 0) return;
    const id = created[Math.floor(rng() * created.length)];
    try {
      if (await manager.isAnnounceable(id)) {
        await manager.connect(relayer).announceCharge(id);
        hits.announces++;
      }
      if (await manager.isChargeable(id)) {
        const before = await manager.getSubscription(id);
        await manager.connect(relayer).charge(id);
        const after = await manager.getSubscription(id);
        const now = BigInt(await time.latest());

        // Checked here rather than in the global sweep: this only holds at the
        // instant of the charge. It is the property that makes a second charge
        // in the same block impossible — the off-by-one that allowed it set
        // nextChargeAt exactly equal to the current timestamp.
        expect(after.nextChargeAt > now, `charge left nextChargeAt ${after.nextChargeAt} <= ${now}`)
          .to.be.true;

        // Exactly one period is consumed per charge.
        expect(after.periodsCharged - before.periodsCharged).to.equal(1n);
        expect(before.remainingAuthorised - after.remainingAuthorised).to.equal(
          before.amountPerPeriod
        );
        hits.charges++;
      }
    } catch (error: any) {
      // A broken invariant must not be swallowed as "the charge was rejected".
      if (/nextChargeAt|periodsCharged|expected/.test(error?.message ?? "")) throw error;
      // Rejected charges are expected; the invariants still have to hold.
    }
  }

  async function tryCancel(rng: () => number): Promise<void> {
    if (created.length === 0) return;
    const id = created[Math.floor(rng() * created.length)];
    try {
      await manager.connect(payer).cancel(id);
      hits.cancels++;
    } catch {
      // Already cancelled, etc.
    }
  }

  /**
   * Run a randomised sequence of operations, checking invariants after each.
   */
  async function fuzzRun(seed: number, steps: number) {
    const rng = makeRng(seed);

    for (let i = 0; i < steps; i++) {
      const roll = rng();

      if (roll < 0.3) {
        await tryCreate(rng);
      } else if (roll < 0.7) {
        await tryCharge(rng);
      } else if (roll < 0.8) {
        await tryCancel(rng);
      } else {
        // Advance time by a random slice of a period, including the exact
        // boundary that the off-by-one schedule bug used to hide behind.
        const jump = [MONTH, MONTH + 1n, MONTH / 2n, MONTH * 3n][Math.floor(rng() * 4)];
        await time.increase(jump);
      }

      await checkInvariants(`seed=${seed} step=${i} roll=${roll.toFixed(3)}`);
    }
  }

  // Distinct seeds explore different interleavings of create/charge/cancel/time.
  const SEEDS = [1, 7, 42, 1337, 99991];

  for (const seed of SEEDS) {
    it(`holds all invariants across a random operation sequence (seed ${seed})`, async () => {
      await fuzzRun(seed, 40);

      // Guard against a vacuous pass: a run in which nothing succeeded would
      // satisfy every invariant while exercising none of them.
      expect(created.length, `seed ${seed}: no subscriptions created`).to.be.greaterThan(0);
      expect(hits.charges, `seed ${seed}: no charges succeeded`).to.be.greaterThan(0);
    }).timeout(180000);
  }

  it("never lets total charged exceed the authorised budget", async () => {
    // The single property that most directly protects the payer: across any
    // sequence, a merchant cannot receive more than what was authorised.
    const maxPeriods = 3;
    const totalAuthorised = AMOUNT * BigInt(maxPeriods);

    const tx = await manager.connect(payer).createSubscription({
      merchant: merchant.address,
      token: tokenAddress,
      amountPerPeriod: AMOUNT,
      totalAuthorised,
      periodSeconds: MONTH,
      firstChargeAt: 0n,
      endTime: 0n,
      noticeSeconds: 0n,
      maxPeriods,
    });
    const receipt = await tx.wait();
    const id = receipt!.logs
      .map((l) => {
        try {
          return manager.interface.parseLog(l as any);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "SubscriptionCreated")!.args.subscriptionId;

    const before = await token.balanceOf(merchant.address);

    // Hammer it: far more charge attempts than the authorisation allows.
    for (let i = 0; i < 20; i++) {
      try {
        await manager.connect(relayer).charge(id);
      } catch {
        // expected once exhausted / not due
      }
      await time.increase(MONTH + 1n);
    }

    const received = (await token.balanceOf(merchant.address)) - before;
    expect(received, "merchant received more than authorised").to.equal(totalAuthorised);
  }).timeout(180000);

  it("keeps two subscriptions from overspending a shared allowance", async () => {
    // Allowance covers exactly two periods total; two subscriptions compete.
    await token.connect(payer).approve(managerAddress, AMOUNT * 2n);

    const terms = {
      merchant: merchant.address,
      token: tokenAddress,
      amountPerPeriod: AMOUNT,
      totalAuthorised: AMOUNT,
      periodSeconds: MONTH,
      firstChargeAt: 0n,
      endTime: 0n,
      noticeSeconds: 0n,
      maxPeriods: 1,
    };

    for (let i = 0; i < 2; i++) {
      const receipt = await (await manager.connect(payer).createSubscription(terms)).wait();
      const id = receipt!.logs
        .map((l) => {
          try {
            return manager.interface.parseLog(l as any);
          } catch {
            return null;
          }
        })
        .find((e) => e?.name === "SubscriptionCreated")!.args.subscriptionId;
      created.push(id);
    }

    // A third would have to draw on budget already reserved by the first two.
    await expect(manager.connect(payer).createSubscription(terms)).to.be.revertedWithCustomError(
      manager,
      "AuthorisationExceedsAllowance"
    );

    const before = await token.balanceOf(merchant.address);
    for (const id of created) {
      await manager.connect(relayer).charge(id);
    }

    expect((await token.balanceOf(merchant.address)) - before).to.equal(AMOUNT * 2n);
    await checkInvariants("shared allowance");
  }).timeout(180000);
});
