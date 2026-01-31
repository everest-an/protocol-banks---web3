"use client"

import React from "react"

import { useWeb3 } from "@/contexts/web3-context"
import { isAdminAddress } from "@/lib/admin-config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldX, Wallet, Loader2 } from "lucide-react"
import Link from "next/link"

interface AdminGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { address, isConnected, isConnecting } = useWeb3()

  // Show loading state while connecting
  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Connecting wallet...</p>
        </div>
      </div>
    )
  }

  // Show connect wallet prompt if not connected
  if (!isConnected || !address) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Please connect your wallet to access the admin dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground text-center">
                Only authorized admin wallets can access this area.
              </p>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full bg-transparent">
                  Return to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    )
  }

  // Check if user is admin
  const isAdmin = isAdminAddress(address)

  if (!isAdmin) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full border-destructive/20">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldX className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Access Denied</CardTitle>
              <CardDescription>
                Your wallet address is not authorized to access the admin area.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Connected Wallet</p>
                <p className="font-mono text-sm break-all">{address}</p>
              </div>
              <Link href="/" className="w-full">
                <Button variant="outline" className="w-full bg-transparent">
                  Return to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    )
  }

  // User is admin, render children
  return <>{children}</>
}
