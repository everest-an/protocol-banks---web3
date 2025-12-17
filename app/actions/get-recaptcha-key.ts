"use server"

export async function getRecaptchaSiteKey() {
  // Server action to securely provide the reCAPTCHA site key
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""
}
