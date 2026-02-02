"use client"
import { useEffect } from "react"

export default function SentryTestPage() {
  useEffect(() => {
    // This error should be captured by Sentry when SENTRY_DSN is configured
    throw new Error("Sentry test error from /sentry-test")
  }, [])

  return <div>Sentry test page — an error will be thrown on mount.</div>
}
