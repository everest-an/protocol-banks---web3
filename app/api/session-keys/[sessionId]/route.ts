/**
 * Session Key Details API
 * GET /api/session-keys/[sessionId] - Get session details
 * POST /api/session-keys/[sessionId] - Perform actions (freeze, unfreeze, revoke, topup)
 */

import { NextRequest, NextResponse } from "next/server";
import { createSessionKeyService, SessionKeyService } from "@/lib/services/session-key-service";
import { isSupportedChain } from "@/types/session-key";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/session-keys/[sessionId]
 * Get details for a specific session
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const chainIdStr = searchParams.get("chainId");

    if (!sessionId || !sessionId.startsWith("0x")) {
      return NextResponse.json(
        { success: false, error: "Invalid session ID" },
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
    const session = await service.getSessionKey(sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Get usage history
    const usageHistory = await service.getUsageHistory(sessionId);

    // Convert BigInt to string for JSON serialization
    const serializedSession = {
      ...session,
      maxBudget: session.maxBudget.toString(),
      usedBudget: session.usedBudget.toString(),
      remainingBudget: session.remainingBudget.toString(),
      maxSingleTx: session.maxSingleTx.toString(),
      maxBudgetEth: SessionKeyService.formatEth(session.maxBudget),
      usedBudgetEth: SessionKeyService.formatEth(session.usedBudget),
      remainingBudgetEth: SessionKeyService.formatEth(session.remainingBudget),
    };

    const serializedHistory = usageHistory.map((r) => ({
      ...r,
      amount: r.amount.toString(),
      amountEth: SessionKeyService.formatEth(r.amount),
    }));

    return NextResponse.json({
      success: true,
      session: serializedSession,
      usageHistory: serializedHistory,
      chainId,
    });
  } catch (error: any) {
    console.error("[API] GET /api/session-keys/[sessionId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch session" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/session-keys/[sessionId]
 * Perform actions on a session (returns transaction data for frontend signing)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { action, chainId, reason, additionalBudgetEth } = body;

    if (!sessionId || !sessionId.startsWith("0x")) {
      return NextResponse.json(
        { success: false, error: "Invalid session ID" },
        { status: 400 }
      );
    }

    if (!isSupportedChain(chainId)) {
      return NextResponse.json(
        { success: false, error: `Unsupported chain ID: ${chainId}` },
        { status: 400 }
      );
    }

    const validActions = ["freeze", "unfreeze", "revoke", "topup"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate action-specific requirements
    if (action === "freeze" && !reason) {
      return NextResponse.json(
        { success: false, error: "Freeze action requires a reason" },
        { status: 400 }
      );
    }

    if (action === "topup") {
      if (!additionalBudgetEth || parseFloat(additionalBudgetEth) <= 0) {
        return NextResponse.json(
          { success: false, error: "Top up requires a positive additional budget" },
          { status: 400 }
        );
      }
    }

    // Return transaction data for frontend to sign
    const transactionData: any = {
      sessionId,
      chainId,
      action,
    };

    if (action === "freeze") {
      transactionData.reason = reason;
    }

    if (action === "topup") {
      transactionData.additionalBudget = SessionKeyService.parseEth(additionalBudgetEth).toString();
    }

    return NextResponse.json({
      success: true,
      transactionData,
      message: `Use this data to call ${action}SessionKey on the contract`,
    });
  } catch (error: any) {
    console.error("[API] POST /api/session-keys/[sessionId] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process action" },
      { status: 500 }
    );
  }
}
