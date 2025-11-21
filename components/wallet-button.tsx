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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Copy, CheckCircle, ExternalLink, AlertTriangle, Smartphone, Bitcoin } from "lucide-react"
import { useState, useEffect } from "react"
import { CHAIN_IDS, isMobileDevice, getMetaMaskDeepLink } from "@/lib/web3"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

export function WalletButton() {
  const {
    wallets,
    activeChain,
    setActiveChain,
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
  const [showConnectModal, setShowConnectModal] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  const formatAddress = (address: string) => {
    if (!address) return ""
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyAddress = async (address: string) => {
    if (address) {
      await navigator.clipboard.writeText(address)
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
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogTrigger asChild>
          <Button disabled={isConnecting}>
            <Wallet className="mr-2 h-4 w-4" />
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Connect Wallet</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="justify-start h-14 bg-transparent"
              onClick={() => {
                connectWallet("EVM")
                setShowConnectModal(false)
              }}
            >
              <div className="bg-blue-100 p-2 rounded-full mr-4">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold">Ethereum / EVM</span>
                <span className="text-xs text-muted-foreground">MetaMask, Rainbow, etc.</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-14 bg-transparent"
              onClick={() => {
                connectWallet("SOLANA")
                setShowConnectModal(false)
              }}
            >
              <div className="bg-purple-100 p-2 rounded-full mr-4">
                <div className="h-5 w-5 rounded-full bg-purple-600" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold">Solana</span>
                <span className="text-xs text-muted-foreground">Phantom, Solflare</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start h-14 bg-transparent"
              onClick={() => {
                connectWallet("BITCOIN")
                setShowConnectModal(false)
              }}
            >
              <div className="bg-orange-100 p-2 rounded-full mr-4">
                <Bitcoin className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex flex-col items-start">
                <span className="font-semibold">Bitcoin</span>
                <span className="text-xs text-muted-foreground">Unisat, Xverse</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Connected but wrong network (only for EVM)
  if (activeChain === "EVM" && wallets.EVM && !isSupportedNetwork) {
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

  const activeWallet = wallets[activeChain]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-border bg-transparent">
          {activeChain === "BITCOIN" ? (
            <Bitcoin className="mr-2 h-4 w-4 text-orange-500" />
          ) : activeChain === "SOLANA" ? (
            <div className="mr-2 h-3 w-3 rounded-full bg-purple-500" />
          ) : (
            <Wallet className="mr-2 h-4 w-4" />
          )}
          <span className="hidden sm:inline">{activeWallet ? formatAddress(activeWallet) : "Connect Wallet"}</span>
          <span className="ml-2 text-xs text-muted-foreground hidden md:inline">
            ({activeChain === "EVM" ? (chainId === CHAIN_IDS.MAINNET ? "Mainnet" : "Sepolia") : activeChain})
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 bg-card border-border">
        <DropdownMenuLabel className="text-foreground">Connected Wallets</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />

        {/* EVM Section */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <Wallet className="mr-2 h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Ethereum</span>
            </div>
            {wallets.EVM ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatAddress(wallets.EVM)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setActiveChain("EVM")}
                  disabled={activeChain === "EVM"}
                >
                  {activeChain === "EVM" && <CheckCircle className="h-3 w-3 text-green-500" />}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs bg-transparent"
                onClick={() => connectWallet("EVM")}
              >
                Connect
              </Button>
            )}
          </div>
          {wallets.EVM && activeChain === "EVM" && (
            <div className="pl-6 space-y-1 mt-2 bg-secondary/20 p-2 rounded">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">USDT:</span>
                <span className="font-mono">{Number.parseFloat(usdtBalance).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">USDC:</span>
                <span className="font-mono">{Number.parseFloat(usdcBalance).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="bg-border" />

        {/* Solana Section */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <div className="mr-2 h-4 w-4 rounded-full bg-purple-500" />
              <span className="text-sm font-medium">Solana</span>
            </div>
            {wallets.SOLANA ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatAddress(wallets.SOLANA)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setActiveChain("SOLANA")}
                  disabled={activeChain === "SOLANA"}
                >
                  {activeChain === "SOLANA" && <CheckCircle className="h-3 w-3 text-green-500" />}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs bg-transparent"
                onClick={() => connectWallet("SOLANA")}
              >
                Connect
              </Button>
            )}
          </div>
        </div>

        <DropdownMenuSeparator className="bg-border" />

        {/* Bitcoin Section */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center">
              <Bitcoin className="mr-2 h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Bitcoin</span>
            </div>
            {wallets.BITCOIN ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatAddress(wallets.BITCOIN)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setActiveChain("BITCOIN")}
                  disabled={activeChain === "BITCOIN"}
                >
                  {activeChain === "BITCOIN" && <CheckCircle className="h-3 w-3 text-green-500" />}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs bg-transparent"
                onClick={() => connectWallet("BITCOIN")}
              >
                Connect
              </Button>
            )}
          </div>
        </div>

        <DropdownMenuSeparator className="bg-border" />

        {activeChain === "EVM" && wallets.EVM && (
          <DropdownMenuItem
            onClick={() => switchNetwork(chainId === CHAIN_IDS.MAINNET ? CHAIN_IDS.SEPOLIA : CHAIN_IDS.MAINNET)}
          >
            Switch to {chainId === CHAIN_IDS.MAINNET ? "Sepolia" : "Mainnet"}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => activeWallet && copyAddress(activeWallet)} className="cursor-pointer">
          {copied ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              Copied Address
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Active Address
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {wallets.EVM && (
              <DropdownMenuItem onClick={() => disconnectWallet("EVM")}>Disconnect Ethereum</DropdownMenuItem>
            )}
            {wallets.SOLANA && (
              <DropdownMenuItem onClick={() => disconnectWallet("SOLANA")}>Disconnect Solana</DropdownMenuItem>
            )}
            {wallets.BITCOIN && (
              <DropdownMenuItem onClick={() => disconnectWallet("BITCOIN")}>Disconnect Bitcoin</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => disconnectWallet()} className="text-destructive">
              Disconnect All
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
