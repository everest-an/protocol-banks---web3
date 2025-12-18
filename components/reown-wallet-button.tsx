"use client"

import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Copy, CheckCircle, Mail, CreditCard, Smartphone } from "lucide-react"
import { useState } from "react"

export function ReownWalletButton() {
  const { open } = useAppKit()
  const { address, isConnected, caipAddress, status } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider("eip155")
  const [copied, setCopied] = useState(false)

  const formatAddress = (addr: string) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const openOnRamp = () => {
    // Open Reown's built-in on-ramp (buy crypto with fiat)
    open({ view: "OnRampProviders" })
  }

  if (!isConnected) {
    return (
      <div className="flex gap-2">
        <Button
          onClick={() => open()}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-2 sm:px-4"
        >
          <Mail className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Email / Social Login</span>
          <span className="xs:hidden">Login</span>
        </Button>
        <Button
          onClick={() => open({ view: "Connect" })}
          variant="outline"
          size="sm"
          className="text-xs sm:text-sm px-2 sm:px-4"
        >
          <Wallet className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">Wallet</span>
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
          <Wallet className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline truncate max-w-[80px] sm:max-w-none">{formatAddress(address || "")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-card border-border">
        <DropdownMenuLabel className="text-foreground">Connected Account</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />

        <div className="px-2 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Address</span>
            <span className="text-xs font-mono">{formatAddress(address || "")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Connected
            </span>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem onClick={openOnRamp} className="cursor-pointer">
          <CreditCard className="mr-2 h-4 w-4" />
          Buy Crypto (Fiat On-Ramp)
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => open({ view: "Account" })} className="cursor-pointer">
          <Smartphone className="mr-2 h-4 w-4" />
          Account Details
        </DropdownMenuItem>

        <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
          {copied ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              Copied Address
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Address
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          onClick={() => open({ view: "Account" })}
          className="cursor-pointer text-red-500 focus:text-red-500"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
