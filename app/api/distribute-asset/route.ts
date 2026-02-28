/**
 * Post-Payment Asset Distribution API
 *
 * Triggered after successful payment to distribute NFTs/tokens to payers.
 * Can be called directly or via webhook after payment confirmation.
 */

import { type NextRequest, NextResponse } from "next/server"
import { distributeAsset, checkAssetAvailability, type AssetDistributionConfig } from "@/lib/asset-distribution"
import { prisma } from "@/lib/prisma"
import { withAuth } from "@/lib/middleware/api-auth"

export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const {
      paymentTxHash,
      recipientAddress,
      assetType,
      contractAddress,
      chainId,
      tokenId,
      amount,
      erc1155Id,
      erc1155Amount,
      linkId, // optional payment link reference
      invoiceId, // optional invoice reference
    } = body

    // Validate required fields
    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid recipient address" }, { status: 400 })
    }

    if (!contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json({ error: "Invalid contract address" }, { status: 400 })
    }

    if (!assetType || !["nft", "token", "erc1155"].includes(assetType)) {
      return NextResponse.json({ error: "Invalid asset type" }, { status: 400 })
    }

    // Get distributor wallet from environment
    const distributorAddress = process.env.ASSET_DISTRIBUTOR_ADDRESS
    const distributorPrivateKey = process.env.ASSET_DISTRIBUTOR_PRIVATE_KEY

    if (!distributorAddress || !distributorPrivateKey) {
      return NextResponse.json(
        { error: "Asset distribution not configured. Set ASSET_DISTRIBUTOR_ADDRESS and ASSET_DISTRIBUTOR_PRIVATE_KEY." },
        { status: 500 },
      )
    }

    const config: AssetDistributionConfig = {
      assetType,
      contractAddress,
      chainId: chainId || 8453, // Default to Base
      tokenId,
      amount,
      erc1155Id,
      erc1155Amount,
      distributorAddress,
      distributorPrivateKey,
    }

    // Check availability first
    const availability = await checkAssetAvailability({
      assetType: config.assetType,
      contractAddress: config.contractAddress,
      chainId: config.chainId,
      tokenId: config.tokenId,
      amount: config.amount,
      erc1155Id: config.erc1155Id,
      erc1155Amount: config.erc1155Amount,
      distributorAddress: config.distributorAddress,
    })

    if (!availability.available) {
      return NextResponse.json(
        { error: `Asset not available: ${availability.error}` },
        { status: 400 },
      )
    }

    // Distribute the asset
    const result = await distributeAsset(config, recipientAddress)

    // Record distribution in database
    try {
      await prisma.assetDistribution.create({
        data: {
          payment_tx_hash: paymentTxHash,
          distribution_tx: result.txHash,
          recipient_address: recipientAddress,
          asset_type: assetType,
          contract_address: contractAddress,
          chain_id: chainId || 8453,
          token_id: tokenId,
          amount: amount,
          status: result.success ? "completed" : "failed",
          error_message: result.error,
          payment_link_id: linkId,
          invoice_id: invoiceId,
        },
      })
    } catch (dbError) {
      console.warn("[Asset Distribution] DB recording failed:", dbError)
      // Non-blocking - distribution already happened
    }

    if (result.success) {
      return NextResponse.json({
        success: true,
        distributionTxHash: result.txHash,
        assetType: result.assetType,
        contractAddress: result.contractAddress,
        tokenId: result.tokenId,
        amount: result.amount,
        recipientAddress: result.recipientAddress,
      })
    } else {
      return NextResponse.json(
        { error: result.error, details: result },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error("[API] Asset distribution error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to distribute asset" },
      { status: 500 },
    )
  }
}, { component: 'distribute-asset' })

// Check asset availability without distributing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assetType = searchParams.get("assetType") as "nft" | "token" | "erc1155"
    const contractAddress = searchParams.get("contractAddress")
    const chainId = parseInt(searchParams.get("chainId") || "8453")
    const tokenId = searchParams.get("tokenId") || undefined
    const amount = searchParams.get("amount") || undefined

    if (!contractAddress || !assetType) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    const distributorAddress = process.env.ASSET_DISTRIBUTOR_ADDRESS
    if (!distributorAddress) {
      return NextResponse.json({ error: "Distribution not configured" }, { status: 500 })
    }

    const result = await checkAssetAvailability({
      assetType,
      contractAddress,
      chainId,
      tokenId,
      amount,
      distributorAddress,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
