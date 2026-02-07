"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { PaymentButton } from "@/components/payment-button"
import { GlassCard, GlassCardContent, GlassCardDescription, GlassCardHeader, GlassCardTitle } from "@/components/ui/glass-card"
import { Badge } from "@/components/ui/badge"
import { Shield, Lock } from "lucide-react"
import Loading from "./loading"

function EmbedPaymentContent() {
  const searchParams = useSearchParams()

  const to = searchParams.get("to") || ""
  const amount = searchParams.get("amount") || undefined
  const token = searchParams.get("token") || "USDC"
  const merchantName = searchParams.get("merchant") || undefined
  const description = searchParams.get("desc") || undefined
  const label = searchParams.get("label") || "Pay Now"
  const allowCustom = searchParams.get("custom") === "true"
  const theme = searchParams.get("theme") || "light"

  // Validate required params
  if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <GlassCard className="max-w-md">
          <GlassCardHeader>
            <GlassCardTitle className="text-red-600">Invalid Payment Link</GlassCardTitle>
            <GlassCardDescription>
              This payment link is missing required parameters or has an invalid recipient address.
            </GlassCardDescription>
          </GlassCardHeader>
        </GlassCard>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${theme === "dark" ? "dark bg-zinc-950" : "bg-gray-50"}`}
    >
      <GlassCard className="w-full max-w-md shadow-lg">
        <GlassCardHeader className="text-center">
          {merchantName && <GlassCardTitle className="text-xl">{merchantName}</GlassCardTitle>}
          {description && <GlassCardDescription>{description}</GlassCardDescription>}
        </GlassCardHeader>
        <GlassCardContent className="space-y-6">
          {/* Amount Display */}
          {amount && (
            <div className="text-center py-4">
              <p className="text-5xl font-bold">${amount}</p>
              <Badge variant="secondary" className="mt-2">
                {token}
              </Badge>
            </div>
          )}

          {/* Payment Button */}
          <PaymentButton
            to={to}
            amount={amount}
            token={token}
            label={label}
            merchantName={merchantName}
            description={description}
            allowCustomAmount={allowCustom}
            className="w-full"
            size="lg"
            onSuccess={(txHash) => {
              // Post message to parent window for iframe integration
              if (window.parent !== window) {
                window.parent.postMessage(
                  {
                    type: "PROTOCOL_BANKS_PAYMENT_SUCCESS",
                    txHash,
                    amount,
                    token,
                    to,
                  },
                  "*",
                )
              }
            }}
            onError={(error) => {
              if (window.parent !== window) {
                window.parent.postMessage(
                  {
                    type: "PROTOCOL_BANKS_PAYMENT_ERROR",
                    error: error.message,
                  },
                  "*",
                )
              }
            }}
          />

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            <span>Secured by Protocol Banks</span>
            <Lock className="h-3 w-3" />
          </div>

          {/* Recipient Info */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>
              Paying to: {to.slice(0, 10)}...{to.slice(-8)}
            </p>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  )
}

export default function EmbedPayPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EmbedPaymentContent />
    </Suspense>
  )
}
