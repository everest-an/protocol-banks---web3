"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[App] Global error:", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <a href="/">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </a>
        </Button>
        <Button onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}
