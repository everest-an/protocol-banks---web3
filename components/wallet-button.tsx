"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Copy, CheckCircle, ExternalLink, AlertTriangle, Smartphone } from "lucide-react"
import { useState, useEffect } from "react"
import { CHAIN_IDS, isMobileDevice, getMetaMaskDeepLink } from "@/lib/web3"

export function WalletButton() {
  const {
    wallet,
    isConnected,
    isConnecting,
    usdtBalance,
    usdcBalance,
    connectWallet,
    disconnectWallet,
    isMetaMaskInstalled,
    chainId,
    switchNetwork,
    isSupportedNetwork,
  } = useWeb3()
  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyAddress = async () => {
    if (wallet) {
      await navigator.clipboard.writeText(wallet)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleMobileConnect = () => {
    const deepLink = getMetaMaskDeepLink()
    window.location.href = deepLink
  }

  // Mobile handling: If mobile and no provider, show "Open in MetaMask"
  if (isMobile && !isMetaMaskInstalled) {
    return (
      <Button onClick={handleMobileConnect} className="bg-orange-600 text-white hover:bg-orange-700">
        <Smartphone className="mr-2 h-4 w-4" />
        Open in MetaMask
      </Button>
    )
  }

  if (!isMetaMaskInstalled) {
    return (
      <Button
        onClick={() => window.open("https://metamask.io/download/", "_blank")}
        className="bg-orange-600 text-white hover:bg-orange-700"
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        Install MetaMask
      </Button>
    )
  }

  if (!isConnected) {
    return (
      <Button onClick={connectWallet} disabled={isConnecting}>
        <Wallet className="mr-2 h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  // Connected but wrong network
  if (!isSupportedNetwork) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="destructive">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Wrong Network
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => switchNetwork(CHAIN_IDS.MAINNET)}>Switch to Mainnet</DropdownMenuItem>
          <DropdownMenuItem onClick={() => switchNetwork(CHAIN_IDS.SEPOLIA)}>Switch to Sepolia (Test)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-border bg-transparent">
          <Wallet className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">{formatAddress(wallet!)}</span>
          <span className="ml-2 text-xs text-muted-foreground hidden md:inline">
            ({chainId === CHAIN_IDS.MAINNET ? "Mainnet" : "Sepolia"})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-card border-border">
        <DropdownMenuLabel className="text-foreground">
          My Wallet
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {chainId === CHAIN_IDS.MAINNET ? "Ethereum Mainnet" : "Sepolia Testnet"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <div className="px-2 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">USDT Balance:</span>
            <span className="font-mono text-foreground">{Number.parseFloat(usdtBalance).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">USDC Balance:</span>
            <span className="font-mono text-foreground">{Number.parseFloat(usdcBalance).toFixed(2)}</span>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-border" />

        {chainId === CHAIN_IDS.MAINNET ? (
          <DropdownMenuItem onClick={() => switchNetwork(CHAIN_IDS.SEPOLIA)}>Switch to Sepolia (Test)</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => switchNetwork(CHAIN_IDS.MAINNET)}>Switch to Mainnet</DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
          {copied ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Address
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnectWallet} className="cursor-pointer text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
