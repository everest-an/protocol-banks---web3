"use server"

export async function getRecaptchaSiteKey() {
  return process.env.RECAPTCHA_SITE_KEY || ""
}
