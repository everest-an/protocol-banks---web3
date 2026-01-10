import { getRecaptchaSiteKey } from "@/app/actions/get-recaptcha-key"
import Script from "next/script"

export async function RecaptchaScript() {
  const siteKey = await getRecaptchaSiteKey()

  if (!siteKey) return null

  return <Script src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`} strategy="lazyOnload" />
}
