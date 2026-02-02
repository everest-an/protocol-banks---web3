/**
 * Session Keys API
 * POST /api/session-keys - Create a new session key
 * GET /api/session-keys - List session keys for owner
 */

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { createSessionKeyService, SessionKeyService } from "@/lib/services/session-key-service";
import {
  CreateSessionKeyRequest,
  ListSessionsRequest,
  isSupportedChain,
} from "@/types/session-key";

/**
 * POST /api/session-keys
 * Create a new session key (requires wallet signature for verification)
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateSessionKeyRequest = await request.json();

    // Validate required fields
    if (!body.sessionKeyAddress || !ethers.isAddress(body.sessionKeyAddress)) {
      return NextResponse.json(
        { success: false, error: "Invalid session key address" },
        { status: 400 }
      );
    }

    if (!body.maxBudgetEth || parseFloat(body.maxBudgetEth) <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid max budget" },
        { status: 400 }
      );
    }

    if (!body.maxSingleTxEth || parseFloat(body.maxSingleTxEth) <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid max single tx" },
        { status: 400 }
      );
    }

    if (!body.durationHours || body.durationHours < 1) {
      return NextResponse.json(
        { success: false, error: "Invalid duration (minimum 1 hour)" },
        { status: 400 }
      );
    }

    if (!isSupportedChain(body.chainId)) {
      return NextResponse.json(
        { success: false, error: `Unsupported chain ID: ${body.chainId}` },
        { status: 400 }
      );
    }

    // Note: In production, this would be called from the frontend with user's wallet
    // Here we just validate the request and return the transaction data
    const maxBudget = SessionKeyService.parseEth(body.maxBudgetEth);
    const maxSingleTx = SessionKeyService.parseEth(body.maxSingleTxEth);
    const durationSeconds = body.durationHours * 3600;

    // Validate maxSingleTx <= maxBudget
    if (maxSingleTx > maxBudget) {
      return NextResponse.json(
        { success: false, error: "Max single tx cannot exceed max budget" },
        { status: 400 }
      );
    }

    // Return transaction data for frontend to sign
    return NextResponse.json({
      success: true,
      transactionData: {
        chainId: body.chainId,
        sessionKeyAddress: body.sessionKeyAddress,
        maxBudget: maxBudget.toString(),
        maxSingleTx: maxSingleTx.toString(),
        durationSeconds,
        allowedTokens: body.allowedTokens || [],
        allowedTargets: body.allowedTargets || [],
      },
      message: "Use this data to call createSessionKey on the contract",
    });
  } catch (error: any) {
    console.error("[API] POST /api/session-keys error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process request" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/session-keys
 * List all session keys for an owner address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerAddress = searchParams.get("owner");
    const chainIdStr = searchParams.get("chainId");

    if (!ownerAddress || !ethers.isAddress(ownerAddress)) {
      return NextResponse.json(
        { success: false, error: "Invalid owner address" },
        { status: 400 }
      );
    }

    const chainId = parseInt(chainIdStr || "8453", 10);
    if (!isSupportedChain(chainId)) {
      return NextResponse.json(
        { success: false, error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    const service = createSessionKeyService(chainId);
    const sessions = await service.getOwnerSessions(ownerAddress);

    // Convert BigInt to string for JSON serialization
    const serializedSessions = sessions.map((s) => ({
      ...s,
      maxBudget: s.maxBudget.toString(),
      usedBudget: s.usedBudget.toString(),
      remainingBudget: s.remainingBudget.toString(),
      maxSingleTx: s.maxSingleTx.toString(),
      maxBudgetEth: SessionKeyService.formatEth(s.maxBudget),
      usedBudgetEth: SessionKeyService.formatEth(s.usedBudget),
      remainingBudgetEth: SessionKeyService.formatEth(s.remainingBudget),
    }));

    return NextResponse.json({
      success: true,
      sessions: serializedSessions,
      chainId,
    });
  } catch (error: any) {
    console.error("[API] GET /api/session-keys error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
