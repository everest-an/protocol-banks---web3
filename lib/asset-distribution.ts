/**
 * Post-Payment Asset Distribution Service
 *
 * Automatically distribute NFTs or tokens to payers after successful payment.
 * Supports ERC-721 (NFT) and ERC-20 (Token) distributions.
 */

import { ethers } from "ethers"
import { RPC_URLS, CHAIN_IDS } from "@/lib/web3"

// ERC-721 ABI (for NFT transfers)
const ERC721_ABI = [
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
]

// ERC-20 ABI (for token transfers)
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
]

// ERC-1155 ABI (for multi-token standard)
const ERC1155_ABI = [
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
]

export interface AssetDistributionConfig {
  assetType: "nft" | "token" | "erc1155"
  contractAddress: string
  chainId: number
  // NFT specific
  tokenId?: string
  // Token specific
  amount?: string
  // ERC-1155 specific
  erc1155Id?: string
  erc1155Amount?: string
  // Distribution wallet (holds the assets)
  distributorAddress: string
  distributorPrivateKey: string
}

export interface DistributionResult {
  success: boolean
  txHash?: string
  error?: string
  assetType: string
  contractAddress: string
  tokenId?: string
  amount?: string
  recipientAddress: string
}

/**
 * Check if an asset is available for distribution
 */
export async function checkAssetAvailability(
  config: Omit<AssetDistributionConfig, "distributorPrivateKey">,
): Promise<{ available: boolean; error?: string }> {
  try {
    const rpcUrl = RPC_URLS[config.chainId as keyof typeof RPC_URLS]
    if (!rpcUrl) {
      return { available: false, error: `Unsupported chain ID: ${config.chainId}` }
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)

    if (config.assetType === "nft") {
      const contract = new ethers.Contract(config.contractAddress, ERC721_ABI, provider)
      const owner = await contract.ownerOf(config.tokenId)
      if (owner.toLowerCase() !== config.distributorAddress.toLowerCase()) {
        return { available: false, error: "Distributor does not own this NFT" }
      }
      return { available: true }
    }

    if (config.assetType === "token") {
      const contract = new ethers.Contract(config.contractAddress, ERC20_ABI, provider)
      const decimals = await contract.decimals()
      const balance = await contract.balanceOf(config.distributorAddress)
      const requiredAmount = ethers.parseUnits(config.amount || "0", decimals)
      if (balance < requiredAmount) {
        return {
          available: false,
          error: `Insufficient token balance. Has: ${ethers.formatUnits(balance, decimals)}, Needs: ${config.amount}`,
        }
      }
      return { available: true }
    }

    if (config.assetType === "erc1155") {
      const contract = new ethers.Contract(config.contractAddress, ERC1155_ABI, provider)
      const balance = await contract.balanceOf(config.distributorAddress, config.erc1155Id)
      const requiredAmount = BigInt(config.erc1155Amount || "1")
      if (balance < requiredAmount) {
        return { available: false, error: "Insufficient ERC-1155 token balance" }
      }
      return { available: true }
    }

    return { available: false, error: "Unknown asset type" }
  } catch (error: any) {
    return { available: false, error: error.message }
  }
}

/**
 * Distribute an asset to a recipient after payment
 */
export async function distributeAsset(
  config: AssetDistributionConfig,
  recipientAddress: string,
): Promise<DistributionResult> {
  try {
    // Validate recipient address
    if (!ethers.isAddress(recipientAddress)) {
      return {
        success: false,
        error: "Invalid recipient address",
        assetType: config.assetType,
        contractAddress: config.contractAddress,
        recipientAddress,
      }
    }

    const rpcUrl = RPC_URLS[config.chainId as keyof typeof RPC_URLS]
    if (!rpcUrl) {
      return {
        success: false,
        error: `Unsupported chain ID: ${config.chainId}`,
        assetType: config.assetType,
        contractAddress: config.contractAddress,
        recipientAddress,
      }
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const wallet = new ethers.Wallet(config.distributorPrivateKey, provider)

    if (config.assetType === "nft") {
      return await distributeNFT(wallet, config, recipientAddress)
    }

    if (config.assetType === "token") {
      return await distributeToken(wallet, config, recipientAddress)
    }

    if (config.assetType === "erc1155") {
      return await distributeERC1155(wallet, config, recipientAddress)
    }

    return {
      success: false,
      error: "Unknown asset type",
      assetType: config.assetType,
      contractAddress: config.contractAddress,
      recipientAddress,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
      assetType: config.assetType,
      contractAddress: config.contractAddress,
      recipientAddress,
    }
  }
}

async function distributeNFT(
  wallet: ethers.Wallet,
  config: AssetDistributionConfig,
  recipientAddress: string,
): Promise<DistributionResult> {
  const contract = new ethers.Contract(config.contractAddress, ERC721_ABI, wallet)

  // Verify ownership
  const owner = await contract.ownerOf(config.tokenId)
  if (owner.toLowerCase() !== config.distributorAddress.toLowerCase()) {
    return {
      success: false,
      error: "Distributor does not own this NFT",
      assetType: "nft",
      contractAddress: config.contractAddress,
      tokenId: config.tokenId,
      recipientAddress,
    }
  }

  // Transfer NFT
  const tx = await contract.safeTransferFrom(config.distributorAddress, recipientAddress, config.tokenId)
  const receipt = await tx.wait()

  return {
    success: true,
    txHash: receipt.hash,
    assetType: "nft",
    contractAddress: config.contractAddress,
    tokenId: config.tokenId,
    recipientAddress,
  }
}

async function distributeToken(
  wallet: ethers.Wallet,
  config: AssetDistributionConfig,
  recipientAddress: string,
): Promise<DistributionResult> {
  const contract = new ethers.Contract(config.contractAddress, ERC20_ABI, wallet)

  const decimals = await contract.decimals()
  const amount = ethers.parseUnits(config.amount || "0", decimals)

  // Verify balance
  const balance = await contract.balanceOf(config.distributorAddress)
  if (balance < amount) {
    return {
      success: false,
      error: "Insufficient token balance for distribution",
      assetType: "token",
      contractAddress: config.contractAddress,
      amount: config.amount,
      recipientAddress,
    }
  }

  // Transfer tokens
  const tx = await contract.transfer(recipientAddress, amount)
  const receipt = await tx.wait()

  return {
    success: true,
    txHash: receipt.hash,
    assetType: "token",
    contractAddress: config.contractAddress,
    amount: config.amount,
    recipientAddress,
  }
}

async function distributeERC1155(
  wallet: ethers.Wallet,
  config: AssetDistributionConfig,
  recipientAddress: string,
): Promise<DistributionResult> {
  const contract = new ethers.Contract(config.contractAddress, ERC1155_ABI, wallet)

  const tokenId = config.erc1155Id || "0"
  const amount = config.erc1155Amount || "1"

  // Verify balance
  const balance = await contract.balanceOf(config.distributorAddress, tokenId)
  if (balance < BigInt(amount)) {
    return {
      success: false,
      error: "Insufficient ERC-1155 balance",
      assetType: "erc1155",
      contractAddress: config.contractAddress,
      tokenId,
      amount,
      recipientAddress,
    }
  }

  // Transfer ERC-1155
  const tx = await contract.safeTransferFrom(
    config.distributorAddress,
    recipientAddress,
    tokenId,
    amount,
    "0x",
  )
  const receipt = await tx.wait()

  return {
    success: true,
    txHash: receipt.hash,
    assetType: "erc1155",
    contractAddress: config.contractAddress,
    tokenId,
    amount,
    recipientAddress,
  }
}
