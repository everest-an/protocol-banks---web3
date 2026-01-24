"use client"

import { useEffect, useState } from "react"
import Script from "next/script"

export function RecaptchaScript() {
  const [siteKey, setSiteKey] = useState<string | null>(null)

  useEffect(() => {
    // Get the site key from environment variable on client side
    const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
    if (key) {
      setSiteKey(key)
    }
  }, [])

  if (!siteKey) return null

  return <Script src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`} strategy="lazyOnload" />
}
