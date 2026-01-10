"use server"

export async function checkEnvironmentVariables() {
  return {
    SUPABASE: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    REOWN: !!process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
    ETHERSCAN: !!process.env.ETHERSCAN_API_KEY || !!process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    RECAPTCHA: !!process.env.RECAPTCHA_SITE_KEY,
    RESEND: !!process.env.RESEND_API_KEY,
  }
}
