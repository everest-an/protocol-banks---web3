"use client"

import Link from "next/link"
import { useState } from "react"
import { useWeb3 } from "@/contexts/web3-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Copy, Check, ChevronDown, Bot, Loader2, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

/**
 * Wallet connect button — deliberately minimal.
 *
 * v1 supports MetaMask (and other injected EVM wallets). Email/OAuth and
 * Reown AppKit login paths were removed from the header to keep the
 * onboarding surface clean; they can return behind a settings toggle
 * when the product needs them.
 */
export function UnifiedWalletButton() {
  const {
    isConnected,
    connectWallet,
    disconnectWallet,
    activeChain,
    wallets,
    isConnecting,
    isMetaMaskInstalled,
  } = useWeb3()
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const address = wallets[activeChain]

  const handleConnect = async () => {
    if (!isMetaMaskInstalled) {
      toast({
        title: "Wallet not found",
        description: "Install MetaMask (or another injected EVM wallet) to continue.",
        variant: "destructive",
      })
      return
    }
    try {
      await connectWallet()
    } catch {
      toast({
        title: "Connection failed",
        description: "The wallet rejected the connection. Please try again.",
        variant: "destructive",
      })
    }
  }

  const copyAddress = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isConnected) {
    return (
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4"
      >
        {isConnecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wallet className="mr-1.5 h-3.5 w-3.5" />}
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <div className="h-5 w-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="hidden sm:inline text-xs font-mono">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Connected</p>
            <p className="text-xs text-muted-foreground truncate font-mono">{address}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
          {copied ? <Check className="mr-2 h-4 w-4 text-emerald-500" /> : <Copy className="mr-2 h-4 w-4" />}
          <span>{copied ? "Copied" : "Copy address"}</span>
        </DropdownMenuItem>
        <Link href="/trading" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Bot className="mr-2 h-4 w-4 text-primary" />
            <span>Open AI Trading</span>
            <Badge variant="secondary" className="ml-auto text-xs">Live</Badge>
          </DropdownMenuItem>
        </Link>
        <Link href="https://app.hyperliquid.xyz" target="_blank" rel="noopener noreferrer" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4" />
            <span>Fund on Hyperliquid</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => disconnectWallet()} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
