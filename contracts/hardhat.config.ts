import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    // 本地测试网络
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Arbitrum Sepolia 测试网
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421614,
    },
    // Arbitrum 主网
    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
    },
    // Base Sepolia 测试网
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
    // Base 主网
    base: {
      url: process.env.BASE_RPC || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
    },
    // HashKey Chain 测试网
    hashkeyTestnet: {
      url: process.env.HASHKEY_TESTNET_RPC || "https://hashkeychain-testnet.alt.technology",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 133,
    },
    // HashKey Chain 主网
    hashkey: {
      url: process.env.HASHKEY_RPC || "https://mainnet.hsk.xyz",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 177,
    },
  },
  paths: {
    sources: "./src",  // 合约文件在 src 目录
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
      hashkey: process.env.HASHKEY_API_KEY || "",
      hashkeyTestnet: process.env.HASHKEY_API_KEY || "",
    },
    customChains: [
      {
        network: "hashkey",
        chainId: 177,
        urls: {
          apiURL: "https://explorer.hashkeychain.com/api",
          browserURL: "https://explorer.hashkeychain.com",
        },
      },
      {
        network: "hashkeyTestnet",
        chainId: 133,
        urls: {
          apiURL: "https://hashkeychain-testnet-explorer.alt.technology/api",
          browserURL: "https://hashkeychain-testnet-explorer.alt.technology",
        },
      },
    ],
  },
};

export default config;
