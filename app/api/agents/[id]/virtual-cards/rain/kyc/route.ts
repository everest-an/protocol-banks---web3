import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/middleware/api-auth"
import { agentService } from "@/lib/services/agent-service"
import { submitRainKyc } from "@/lib/services/rain-agent-card.service"

const addressSchema = z.object({
  line1: z.string().min(1),
  city: z.string().min(1),
  region: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().min(2).max(2),
})

const kycSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  birthDate: z.string().min(1),
  nationalId: z.string().min(1),
  countryOfIssue: z.string().min(2),
  address: addressSchema,
  phoneCountryCode: z.string().min(1),
  phoneNumber: z.string().min(1),
  annualSalary: z.string().min(1),
  accountPurpose: z.string().min(1),
  expectedMonthlyVolume: z.string().min(1),
  isTermsOfServiceAccepted: z.literal(true),
})

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Rain KYC failed"
  const status = /not configured/i.test(message)
    ? 503
    : /already exists/i.test(message)
      ? 409
      : 502
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (req, address) => {
    try {
      const { id } = await params
      const agent = await agentService.get(id, address)
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 })

      const parsed = kycSchema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors.map((e) => e.message).join(", ") },
          { status: 400 },
        )
      }

      const ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "0.0.0.0"

      const account = await submitRainKyc(address, {
        ...parsed.data,
        walletAddress: address,
        ipAddress,
      })
      return NextResponse.json({ success: true, account }, { status: 201 })
    } catch (error) {
      return errorResponse(error)
    }
  }, { component: "agents-rain-kyc" })(request)
}
