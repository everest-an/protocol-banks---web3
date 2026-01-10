"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "The login link is invalid or missing.",
  invalid_or_expired_link: "This login link has expired or has already been used.",
  user_creation_failed: "Failed to create your account. Please try again.",
  verification_failed: "Failed to verify your login. Please try again.",
  default: "An unexpected error occurred. Please try again.",
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error") || "default"
  const errorMessage = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-2">Authentication Error</h1>
      <p className="text-white/60 text-sm mb-6">{errorMessage}</p>

      <Link href="/">
        <Button className="bg-white/10 hover:bg-white/20 text-white">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </Link>

      <p className="text-white/30 text-xs mt-6">Error code: {errorCode}</p>
    </>
  )
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>

        <Suspense fallback={<p className="text-white/60">Loading...</p>}>
          <ErrorContent />
        </Suspense>
      </div>
    </div>
  )
}
