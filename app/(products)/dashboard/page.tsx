import { redirect } from "next/navigation"

/**
 * Legacy route — the old dashboard has been merged into /balances (Wallet).
 * Keep this route so old links keep working.
 */
export default function DashboardPage() {
  redirect("/balances")
}
