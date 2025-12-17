"use server"

export async function getRecaptchaSiteKey() {
  // Server action to securely provide the reCAPTCHA site key
  return process.env.RECAPTCHA_SITE_KEY || ""
}
