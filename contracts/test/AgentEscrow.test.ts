import { expect } from "chai";
import { ethers } from "hardhat";

const USDC = 1_000_000n;

async function deploy() {
  const [owner, buyer, seller, resolver, relayer, other] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockERC3009")).deploy();
  await token.waitForDeployment();
  const escrow = await (await ethers.getContractFactory("AgentEscrow")).deploy(
    await token.getAddress(),
    owner.address,
    resolver.address,
  );
  await escrow.waitForDeployment();
  await token.mint(buyer.address, 100n * USDC);
  return { owner, buyer, seller, resolver, relayer, other, token, escrow };
}

async function now() {
  const block = await ethers.provider.getBlock("latest");
  return BigInt(block!.timestamp);
}

async function fund(
  ctx: Awaited<ReturnType<typeof deploy>>,
  orderId: string,
  amount: bigint,
  to?: string,
) {
  const validAfter = 0;
  const validBefore = (await now()) + 3600n;
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const signature = await ctx.buyer.signTypedData(
    {
      name: "USD Coin",
      version: "2",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await ctx.token.getAddress(),
    },
    {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    {
      from: ctx.buyer.address,
      to: to ?? (await ctx.escrow.getAddress()),
      value: amount,
      validAfter,
      validBefore,
      nonce,
    },
  );
  const sig = ethers.Signature.from(signature);
  await ctx.escrow.connect(ctx.relayer).fundWithAuthorization(
    orderId,
    ctx.buyer.address,
    amount,
    validAfter,
    validBefore,
    nonce,
    sig.v,
    sig.r,
    sig.s,
  );
}

async function signRelease(ctx: Awaited<ReturnType<typeof deploy>>, orderId: string, deliveryHash: string) {
  const nonce = 0n;
  const deadline = (await now()) + 3600n;
  const signature = await ctx.buyer.signTypedData(
    {
      name: "Protocol Bank Agent Escrow",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await ctx.escrow.getAddress(),
    },
    {
      Release: [
        { name: "orderId", type: "bytes32" },
        { name: "deliveryHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    { orderId, deliveryHash, nonce, deadline },
  );
  return { nonce, deadline, signature };
}

async function signRefund(ctx: Awaited<ReturnType<typeof deploy>>, orderId: string) {
  const nonce = 0n;
  const deadline = (await now()) + 3600n;
  const signature = await ctx.buyer.signTypedData(
    {
      name: "Protocol Bank Agent Escrow",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await ctx.escrow.getAddress(),
    },
    {
      Refund: [
        { name: "orderId", type: "bytes32" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    { orderId, nonce, deadline },
  );
  return { nonce, deadline, signature };
}

describe("AgentEscrow", () => {
  it("creates, funds, delivers and releases to the seller", async () => {
    const ctx = await deploy();
    const orderId = ethers.id("order-release");
    const deliveryHash = ethers.id("delivery-release");
    const amount = 10n * USDC;

    await ctx.escrow.connect(ctx.buyer).createOrder(orderId, ctx.seller.address, amount, 0, ethers.id("terms"));
    await fund(ctx, orderId, amount);
    await ctx.escrow.connect(ctx.seller).markDelivered(orderId, deliveryHash);
    const rel = await signRelease(ctx, orderId, deliveryHash);
    await ctx.escrow.connect(ctx.relayer).release(orderId, rel.nonce, rel.deadline, rel.signature);

    expect(await ctx.token.balanceOf(ctx.seller.address)).to.equal(amount);
    const order = await ctx.escrow.orders(orderId);
    expect(order.state).to.equal(4);
  });

  it("refunds before delivery and cannot refund after delivery", async () => {
    const ctx = await deploy();
    const orderId = ethers.id("order-refund");
    const amount = 5n * USDC;
    await ctx.escrow.connect(ctx.buyer).createOrder(orderId, ctx.seller.address, amount, 0, ethers.id("terms"));
    await fund(ctx, orderId, amount);
    const refund = await signRefund(ctx, orderId);
    await ctx.escrow.connect(ctx.relayer).refund(orderId, refund.nonce, refund.deadline, refund.signature);
    expect(await ctx.token.balanceOf(ctx.buyer.address)).to.equal(100n * USDC);

    const delivered = ethers.id("order-refund-after-delivery");
    await ctx.escrow.connect(ctx.buyer).createOrder(delivered, ctx.seller.address, amount, 0, ethers.id("terms"));
    await fund(ctx, delivered, amount);
    await ctx.escrow.connect(ctx.seller).markDelivered(delivered, ethers.id("delivery"));
    const second = await signRefund(ctx, delivered);
    await expect(
      ctx.escrow.connect(ctx.relayer).refund(delivered, second.nonce, second.deadline, second.signature),
    ).to.be.revertedWith("not refundable");
  });

  it("rejects a bad release signer and a replayed release", async () => {
    const ctx = await deploy();
    const orderId = ethers.id("order-bad-signer");
    const deliveryHash = ethers.id("delivery-bad");
    const amount = 2n * USDC;
    await ctx.escrow.connect(ctx.buyer).createOrder(orderId, ctx.seller.address, amount, 0, ethers.id("terms"));
    await fund(ctx, orderId, amount);
    await ctx.escrow.connect(ctx.seller).markDelivered(orderId, deliveryHash);

    const rel = await signRelease(ctx, orderId, deliveryHash);
    const wrong = await ctx.other.signTypedData(
      {
        name: "Protocol Bank Agent Escrow",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await ctx.escrow.getAddress(),
      },
      {
        Release: [
          { name: "orderId", type: "bytes32" },
          { name: "deliveryHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { orderId, deliveryHash, nonce: rel.nonce, deadline: rel.deadline },
    );
    await expect(
      ctx.escrow.connect(ctx.relayer).release(orderId, rel.nonce, rel.deadline, wrong),
    ).to.be.revertedWith("bad release signature");

    await ctx.escrow.connect(ctx.relayer).release(orderId, rel.nonce, rel.deadline, rel.signature);
    await expect(
      ctx.escrow.connect(ctx.relayer).release(orderId, rel.nonce, rel.deadline, rel.signature),
    ).to.be.revertedWith("not delivered");
  });

  it("resolves a disputed order to the buyer", async () => {
    const ctx = await deploy();
    const orderId = ethers.id("order-dispute");
    const amount = 7n * USDC;
    await ctx.escrow.connect(ctx.buyer).createOrder(orderId, ctx.seller.address, amount, 0, ethers.id("terms"));
    await fund(ctx, orderId, amount);
    await ctx.escrow.connect(ctx.seller).markDelivered(orderId, ethers.id("disputed-delivery"));
    await ctx.escrow.connect(ctx.buyer).dispute(orderId, ethers.id("reason"));
    await ctx.escrow.connect(ctx.resolver).resolve(orderId, false, ethers.id("resolution"));
    expect(await ctx.token.balanceOf(ctx.buyer.address)).to.equal(100n * USDC);
    const order = await ctx.escrow.orders(orderId);
    expect(order.state).to.equal(5);
  });

  it("cancels an unfunded order and rejects non-buyer funding", async () => {
    const ctx = await deploy();
    const orderId = ethers.id("order-cancel");
    const amount = 3n * USDC;
    await ctx.escrow.connect(ctx.buyer).createOrder(orderId, ctx.seller.address, amount, 0, ethers.id("terms"));
    await ctx.escrow.connect(ctx.buyer).cancel(orderId);
    const order = await ctx.escrow.orders(orderId);
    expect(order.state).to.equal(7);
    await expect(fund(ctx, orderId, amount)).to.be.revertedWith("order not fundable");
  });
});
