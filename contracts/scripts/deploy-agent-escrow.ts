import { ethers, network } from "hardhat";

async function main() {
  const token = process.env.AGENT_ESCROW_TOKEN;
  if (!token) throw new Error("AGENT_ESCROW_TOKEN is required");

  const [deployer] = await ethers.getSigners();
  const owner = process.env.AGENT_ESCROW_OWNER || deployer.address;
  const resolver = process.env.AGENT_ESCROW_RESOLVER || deployer.address;
  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance === 0n) throw new Error(`${deployer.address} has no native gas on ${network.name}`);

  const escrow = await (await ethers.getContractFactory("AgentEscrow")).deploy(token, owner, resolver);
  await escrow.waitForDeployment();
  const address = await escrow.getAddress();

  console.log(`AgentEscrow ${address}`);
  console.log(`token ${token}`);
  console.log(`owner ${owner}`);
  console.log(`resolver ${resolver}`);
  console.log(`network ${network.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
