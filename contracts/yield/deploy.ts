/**
 * Deployment Script for MerchantYieldManager
 *
 * 部署到不同网络:
 * - Base Sepolia (测试): npx hardhat run contracts/yield/deploy.ts --network baseSepolia
 * - Base Mainnet (生产): npx hardhat run contracts/yield/deploy.ts --network base
 * - Ethereum Mainnet: npx hardhat run contracts/yield/deploy.ts --network ethereum
 * - Arbitrum One: npx hardhat run contracts/yield/deploy.ts --network arbitrum
 */

import { ethers } from "hardhat"
import fs from "fs"
import path from "path"

// 加载 Aave 地址配置
const aaveAddresses = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "aave-addresses.json"),
    "utf-8"
  )
)

async function main() {
  const [deployer] = await ethers.getSigners()

  console.log("🚀 Deploying MerchantYieldManager with account:", deployer.address)
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH")

  // 获取当前网络
  const network = await ethers.provider.getNetwork()
  const chainId = Number(network.chainId)

  console.log("🌐 Network:", network.name, "(Chain ID:", chainId, ")")

  // 查找对应的 Aave 地址
  const networkConfig = Object.values(aaveAddresses).find(
    (config: any) => config.chainId === chainId
  ) as any

  if (!networkConfig) {
    throw new Error(`No Aave configuration found for chain ID ${chainId}`)
  }

  console.log("📍 Using Aave V3 configuration for:", networkConfig.name)
  console.log("  - Aave Pool:", networkConfig.aavePool)
  console.log("  - USDT:", networkConfig.usdt)
  console.log("  - aUSDT:", networkConfig.aUsdt)

  // 手续费接收地址 (使用部署者地址或指定地址)
  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS || deployer.address
  console.log("💵 Fee Collector:", feeCollector)

  // 部署合约
  console.log("\n📦 Deploying contract...")
  const MerchantYieldManager = await ethers.getContractFactory("MerchantYieldManager")

  const contract = await MerchantYieldManager.deploy(
    networkConfig.aavePool,
    networkConfig.usdt,
    networkConfig.aUsdt,
    feeCollector
  )

  await contract.waitForDeployment()
  const contractAddress = await contract.getAddress()

  console.log("✅ MerchantYieldManager deployed to:", contractAddress)
  console.log("🔗 Explorer:", `${networkConfig.explorer}/address/${contractAddress}`)

  // 保存部署信息
  const deploymentInfo = {
    network: networkConfig.name,
    chainId,
    contractAddress,
    aavePool: networkConfig.aavePool,
    usdt: networkConfig.usdt,
    aUsdt: networkConfig.aUsdt,
    feeCollector,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    transactionHash: contract.deploymentTransaction()?.hash,
    explorer: `${networkConfig.explorer}/address/${contractAddress}`
  }

  // 写入部署信息到文件
  const deploymentsDir = path.join(__dirname, "deployments")
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `${networkConfig.name.toLowerCase().replace(/\s+/g, "-")}.json`
  )

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2))
  console.log("💾 Deployment info saved to:", deploymentFile)

  // 等待区块确认后验证合约 (可选)
  if (chainId !== 31337 && chainId !== 1337) {
    // 不是本地网络
    console.log("\n⏳ Waiting for block confirmations...")
    await contract.deploymentTransaction()?.wait(5)

    console.log("\n🔍 Verifying contract on block explorer...")
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [
          networkConfig.aavePool,
          networkConfig.usdt,
          networkConfig.aUsdt,
          feeCollector
        ]
      })
      console.log("✅ Contract verified successfully!")
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ Contract already verified")
      } else {
        console.error("❌ Verification failed:", error.message)
        console.log("📝 Verify manually at:", networkConfig.explorer)
      }
    }
  }

  // 打印使用说明
  console.log("\n📋 Next Steps:")
  console.log("1. Set fee collector address (if needed):")
  console.log(`   await contract.setFeeCollector("0x...")`)
  console.log("\n2. Merchant deposits USDT:")
  console.log(`   await usdt.approve("${contractAddress}", amount)`)
  console.log(`   await contract.deposit(amount)`)
  console.log("\n3. Check merchant balance:")
  console.log(`   await contract.getMerchantBalance("0x...")`)
  console.log("\n4. Merchant withdraws:")
  console.log(`   await contract.withdraw(amount) // or withdraw(0) for all`)

  console.log("\n✨ Deployment complete!")
}

// Run deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error)
    process.exit(1)
  })
