/**
 * Demo AI API with HTTP 402 Payment Protection
 *
 * This is a test endpoint to demonstrate the HTTP 402 micropayment gateway.
 * In production, replace this with your actual AI service logic.
 */

import { NextRequest, NextResponse } from "next/server"
import { withPaymentRequired } from "@/lib/middleware/http-402-middleware"

// Demo AI responses
const demoResponses = [
  "The meaning of life is subjective and varies from person to person. Many find meaning through relationships, personal growth, and contributing to something larger than themselves.",
  "Quantum physics is the branch of physics that studies the behavior of matter and energy at the molecular, atomic, nuclear, and even smaller microscopic levels.",
  "Artificial Intelligence refers to the simulation of human intelligence in machines that are programmed to think and learn like humans.",
  "Climate change refers to long-term shifts in global temperatures and weather patterns, primarily caused by human activities.",
  "Blockchain is a distributed ledger technology that maintains a secure and decentralized record of transactions.",
]

function getRandomResponse(): string {
  return demoResponses[Math.floor(Math.random() * demoResponses.length)]
}

/**
 * POST /api/test/ai-demo
 *
 * Protected by HTTP 402 Payment Required middleware.
 * Each request costs $0.05 USDC.
 *
 * Request body:
 * {
 *   "prompt": "Your question here"
 * }
 *
 * Response:
 * {
 *   "result": "AI generated response",
 *   "usage": {
 *     "tokens": 150,
 *     "cost": "0.05"
 *   }
 * }
 */
export const POST = withPaymentRequired({
  providerId: "test_ai_demo",
  pricePerRequest: "0.05", // $0.05 per request

  // Optional: Dynamic pricing based on request
  // pricingFunction: async (request) => {
  //   const body = await request.json()
  //   const tokens = estimateTokens(body.prompt)
  //   return (tokens / 1000 * 0.001).toFixed(6)
  // },

  // Optional: Skip payment for test mode
  skipPaymentCheck: (request) => {
    return request.headers.get("x-test-mode") === "true"
  },

  // Optional: Payment success callback
  onPaymentSuccess: (channelId, amount) => {
    console.log(`[AI Demo] Payment received: ${amount} USDC from channel ${channelId}`)
  },

  // Optional: Payment failure callback
  onPaymentFailure: (error) => {
    console.error(`[AI Demo] Payment failed: ${error}`)
  },
})(async (request, paymentContext) => {
  // At this point, payment has been successfully processed
  // You can safely execute your AI logic

  const body = await request.json()
  const { prompt } = body

  if (!prompt) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing 'prompt' field in request body",
      },
      { status: 400 }
    )
  }

  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Generate demo response
  const result = getRandomResponse()

  // Return AI response with payment info
  return NextResponse.json({
    success: true,
    result,
    usage: {
      tokens: Math.floor(Math.random() * 200) + 50, // Random token count
      cost: "0.05",
    },
    paymentInfo: {
      channelId: paymentContext.channelId,
      amountPaid: paymentContext.amountPaid,
      remainingBalance: paymentContext.remainingBalance,
    },
  })
})

/**
 * GET /api/test/ai-demo
 *
 * Get API information (no payment required)
 */
export async function GET() {
  return NextResponse.json({
    name: "AI Test API",
    description: "Test API protected by HTTP 402 Payment Required",
    pricing: {
      pricePerRequest: "0.05",
      currency: "USDC",
    },
    usage: {
      method: "POST",
      endpoint: "/api/test/ai-demo",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Channel-Id": "ch_xxx (or X-Session-Key: sk_xxx)",
      },
      body: {
        prompt: "Your question here",
      },
    },
    testMode: {
      enabled: true,
      description: "Add 'X-Test-Mode: true' header to skip payment for testing",
    },
  })
}
