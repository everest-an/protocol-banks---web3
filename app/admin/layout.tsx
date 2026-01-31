"use client"

import type { ReactNode } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert, Loader2 } from "lucide-react"
import Link from "next/link"

// Admin wallet addresses - add your admin wallets here
const ADMIN_WALLETS = [
  // Add admin wallet addresses in lowercase
  // Example: "0x1234567890abcdef1234567890abcdef12345678"
]

// For development/demo, allow access if no admin wallets are configured
const ALLOW_ALL_IN_DEVELOPMENT = process.env.NODE_ENV === "development" || ADMIN_WALLETS.length === 0

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isConnected, wallets, activeChain } = useWeb3()
  const currentWallet = wallets[activeChain]?.toLowerCase()

  // Check if current wallet is an admin
  const isAdmin = ALLOW_ALL_IN_DEVELOPMENT || 
    (currentWallet && ADMIN_WALLETS.includes(currentWallet))

  // Not connected state
  if (!isConnected) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-yellow-500" />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              Please connect your wallet to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Only authorized admin wallets can access this area.
            </p>
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Not authorized state
  if (!isAdmin) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <Card className="max-w-md w-full border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
            <CardDescription>
              Your wallet is not authorized to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Connected wallet:
            </p>
            <p className="font-mono text-xs bg-muted rounded px-2 py-1 inline-block mb-4">
              {currentWallet?.slice(0, 6)}...{currentWallet?.slice(-4)}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Contact the system administrator if you believe this is an error.
            </p>
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Authorized - render children
  return <>{children}</>
}
