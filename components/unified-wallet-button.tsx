"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react"
import { usePrivy } from "@privy-io/react-auth"
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Wallet, LogOut, Copy, Check, ChevronDown, Sparkles, Plus, ArrowUpRight, CreditCard } from "lucide-react"
import { useState, useEffect } from "react"
import { isMobileDevice } from "@/lib/web3"
import { AuthGateway } from "@/components/auth"

export function UnifiedWalletButton() {
  const {
    isConnected: isWeb3Connected,
    connectWallet,
    disconnectWallet,
    activeChain,
    wallets,
    isConnecting,
    usdtBalance,
    usdcBalance,
  } = useWeb3()

  const { userType, setUserType, isWeb2User, getLabel } = useUserType()
  const { open: openAppKit } = useAppKit()
  const { address: reownAddress, isConnected: isReownConnected } = useAppKitAccount()
  const { disconnect: reownDisconnect } = useDisconnect()
  const { authenticated: isPrivyAuthenticated, logout: privyLogout, user: privyUser } = usePrivy()
  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showAuthGateway, setShowAuthGateway] = useState(false)
  const [showOffRampModal, setShowOffRampModal] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  const isConnected = isWeb3Connected || isReownConnected || isPrivyAuthenticated
  const privyWalletAddress = privyUser?.wallet?.address
  const activeAddress = reownAddress || wallets[activeChain] || privyWalletAddress

  useEffect(() => {
    if (isPrivyAuthenticated && !isReownConnected && !isWeb3Connected) {
      setUserType("web2")
    } else if (isReownConnected && !isWeb3Connected) {
      setUserType("web2")
    } else if (isWeb3Connected && !isReownConnected) {
      setUserType("web3")
    }
  }, [isReownConnected, isWeb3Connected, isPrivyAuthenticated, setUserType])

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

  const totalBalance = Number.parseFloat(usdtBalance) + Number.parseFloat(usdcBalance)
  const hasZeroBalance = totalBalance === 0

  const handleDisconnect = async () => {
    console.log(
      "[v0] Disconnect clicked, isReownConnected:",
      isReownConnected,
      "isWeb3Connected:",
      isWeb3Connected,
      "isPrivyAuthenticated:",
      isPrivyAuthenticated,
    )

    if (isPrivyAuthenticated) {
      try {
        await privyLogout()
        console.log("[v0] Privy logged out")
      } catch (error) {
        console.error("[v0] Failed to logout Privy:", error)
      }
    }

    if (isReownConnected) {
      try {
        await reownDisconnect()
        console.log("[v0] Reown disconnected")
      } catch (error) {
        console.error("[v0] Failed to disconnect Reown:", error)
      }
    }

    disconnectWallet()
    console.log("[v0] Web3 disconnected")
  }

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => {
            console.log("[v0] Sign In button clicked, setting showAuthGateway to true")
            setShowAuthGateway(true)
          }}
          disabled={isConnecting}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4"
        >
          <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">{isConnecting ? "Connecting..." : "Sign In"}</span>
          <span className="xs:hidden">{isConnecting ? "..." : "Sign In"}</span>
        </Button>

        {showAuthGateway && (
          <AuthGateway
            isOpen={showAuthGateway}
            onClose={() => {
              console.log("[v0] AuthGateway onClose called")
              setShowAuthGateway(false)
            }}
            onSuccess={() => {
              console.log("[v0] AuthGateway onSuccess called")
              setShowAuthGateway(false)
            }}
          />
        )}
      </>
    )
  }

  if (isWeb2User) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <span className="hidden sm:inline text-xs">{formatAddress(activeAddress || "")}</span>
              </div>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">My Account</p>
                <p className="text-xs text-muted-foreground truncate">{activeAddress}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {hasZeroBalance && (
              <>
                <div className="px-2 py-2">
                  <Alert className="bg-primary/10 border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-xs">
                      <span className="font-medium">Get Started!</span> Add funds to start sending payments.
                    </AlertDescription>
                  </Alert>
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            <DropdownMenuItem onClick={() => openAppKit({ view: "OnRampProviders" })} className="cursor-pointer">
              <Plus className="mr-2 h-4 w-4 text-green-500" />
              <span>{getLabel("Add Funds")}</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                Card/Bank
              </Badge>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => setShowOffRampModal(true)} className="cursor-pointer">
              <ArrowUpRight className="mr-2 h-4 w-4 text-blue-500" />
              <span>{getLabel("Withdraw")}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => copyAddress(activeAddress || "")} className="cursor-pointer">
              {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
              <span>{copied ? "Copied!" : "Copy Address"}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleDisconnect}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Off-Ramp Modal */}
        <Dialog open={showOffRampModal} onOpenChange={setShowOffRampModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw Funds</DialogTitle>
              <DialogDescription>Convert your crypto to your bank account or card</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Button
                className="w-full justify-start h-14 bg-transparent"
                variant="outline"
                onClick={() => {
                  setShowOffRampModal(false)
                  openAppKit({ view: "OnRampProviders" })
                }}
              >
                <CreditCard className="mr-3 h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">Bank Transfer</div>
                  <div className="text-xs text-muted-foreground">1-3 business days</div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-transparent">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Wallet className="h-3 w-3 text-orange-500" />
            </div>
            <span className="hidden sm:inline text-xs">{formatAddress(activeAddress || "")}</span>
          </div>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Wallet Connected</p>
              <Badge variant="secondary" className="text-xs">
                {activeChain}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{activeAddress}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => openAppKit({ view: "OnRampProviders" })} className="cursor-pointer">
          <CreditCard className="mr-2 h-4 w-4 text-green-500" />
          <span>Buy Crypto</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            Card/Bank
          </Badge>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => copyAddress(activeAddress || "")} className="cursor-pointer">
          {copied ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <Copy className="mr-2 h-4 w-4" />}
          <span>{copied ? "Copied!" : "Copy Address"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
