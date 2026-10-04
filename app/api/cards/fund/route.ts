import { type NextRequest, NextResponse } from "next/server"
import { parseUnits } from "viem"
import { withAuth } from "@/lib/middleware/api-auth"
import { prisma } from "@/lib/prisma"
import { CHAIN_ID_BY_NAME } from "@/lib/services/batch-execution-worker"
import { validateAuthorizations, type SignedAuthorizationInput } from "@/lib/services/eip3009-authorization"
import { submitTransferWithAuthorization } from "@/lib/services/relayer-submit"
import { getTokenAddress, getTokenDecimals, isERC3009Supported } from "@/lib/erc3009"
import { yativoClient } from "@/lib/services/yativo-client.service"

/**
 * POST /api/cards/fund
 *
 * Non-custodial card funding. The user signs an EIP-3009 authorization paying
 * USDC straight from their own wallet to the provider's deposit address, and
 * the relayer only submits it and pays gas — the funds never touch a
 * platform-controlled wallet. When the deposit lands, the provider balance
 * backing the card is credited; the payment is recorded here for attribution.
 *
 * Body: { cardId?, amount, chainId, authorization: { validAfter, validBefore, nonce, v, r, s } }
 */
export const POST = withAuth(async (request: NextRequest, callerAddress: string) => {
  try {
    const body = await request.json()
    const { cardId, amount, chainId, authorization } = body

    if (!amount || !chainId || !authorization) {
      return NextResponse.json(
        { error: "amount, chainId and authorization are required" },
        { status: 400 },
      )
    }

    // With a cardId the payment is attributed to that card; without one it is a
    // plain balance top-up that gets the provider balance ready for issuance.
    if (cardId) {
      const card = await prisma.userVirtualCard.findUnique({ where: { id: cardId } })
      if (!card || card.owner_address !== callerAddress.toLowerCase()) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 })
      }
      if (card.status === "terminated") {
        return NextResponse.json({ error: "Cannot fund a terminated card" }, { status: 400 })
      }
    }

    const resolvedChainId = Number(chainId)
    if (!isERC3009Supported(resolvedChainId, "USDC")) {
      return NextResponse.json(
        { error: `USDC on chain ${resolvedChainId} does not support EIP-3009` },
        { status: 400 },
      )
    }
    const tokenAddress = getTokenAddress(resolvedChainId, "USDC")
    const chainSlug = Object.entries(CHAIN_ID_BY_NAME).find(([, id]) => id === resolvedChainId)?.[0]
    if (!tokenAddress || !chainSlug) {
      return NextResponse.json({ error: `Unsupported chain ${resolvedChainId}` }, { status: 400 })
    }

    // The funding target is the provider's deposit address — fetched here so the
    // authorization can be pinned to it and nothing else.
    let depositAddress: string
    try {
      const deposit = await yativoClient.getDepositAddress("USDC")
      depositAddress = deposit.data.address
      if (!depositAddress) throw new Error("deposit address missing")
    } catch (error) {
      return NextResponse.json(
        {
          error:
            "Card funding is not available: the provider credentials are missing or rejected. " +
            "Set valid YATIVO_API_KEY / YATIVO_API_SECRET.",
        },
        { status: 503 },
      )
    }

    // Validate the signature against the deposit address and the amount.
    let validated: Awaited<ReturnType<typeof validateAuthorizations>>
    try {
      validated = await validateAuthorizations(
        callerAddress,
        callerAddress,
        [
          {
            index: 0,
            recipient: depositAddress,
            amount: { toString: () => String(amount) },
            token: "USDC",
            chain: chainSlug,
            status: "pending",
            chainId: resolvedChainId,
          },
        ],
        [{ index: 0, ...(authorization as Omit<SignedAuthorizationInput, "index">) }],
      )
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid authorization" },
        { status: 400 },
      )
    }

    const txHash = await submitTransferWithAuthorization({
      chainId: resolvedChainId,
      tokenAddress,
      from: callerAddress,
      to: depositAddress,
      value: parseUnits(String(amount), getTokenDecimals(resolvedChainId, "USDC")),
      validAfter: validated[0].validAfter,
      validBefore: validated[0].validBefore,
      nonce: validated[0].nonce,
      v: validated[0].v,
      r: validated[0].r,
      s: validated[0].s,
    })

    // Attribution: the deposit credits the provider balance that backs this
    // user's card, so record who paid what.
    try {
      await prisma.payment.create({
        data: {
          from_address: callerAddress,
          to_address: depositAddress,
          amount: String(amount),
          token: "USDC",
          chain: chainSlug,
          chain_id: resolvedChainId,
          network_type: "EVM",
          status: "completed",
          type: "sent",
          method: "card",
          tx_hash: txHash,
          memo: cardId ? `Card top-up ${cardId}` : "Card balance top-up",
        },
      })
    } catch (dbError) {
      // The money moved on-chain; a ledger hiccup must not hide that.
      console.warn("[cards/fund] payment recording failed:", dbError)
    }

    return NextResponse.json({
      success: true,
      txHash,
      depositAddress,
      amount,
      note: "Deposit confirmed on-chain. The provider credits the balance within 1-3 minutes; issue or top up your card once it lands.",
    })
  } catch (error: any) {
    console.error("[cards/fund] error:", error)
    return NextResponse.json({ error: error.message || "Card funding failed" }, { status: 500 })
  }
}, { component: "cards-fund" })
