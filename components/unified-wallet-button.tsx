"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { useAppKit, useAppKitAccount } from "@reown/appkit/react"
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
import {
  User,
  Wallet,
  LogOut,
  Copy,
  Check,
  ChevronDown,
  Mail,
  Shield,
  ArrowRight,
  HelpCircle,
  Sparkles,
  Plus,
  ArrowUpRight,
  CreditCard,
} from "lucide-react"
import { useState, useEffect } from "react"
import { isMobileDevice, getMetaMaskDeepLink } from "@/lib/web3"

export function UnifiedWalletButton() {
  const {
    isConnected: isWeb3Connected,
    connectWallet,
    disconnect: web3Disconnect,
    activeChain,
    wallets,
    isConnecting,
    usdtBalance,
    usdcBalance,
  } = useWeb3()

  const { userType, setUserType, isWeb2User, getLabel } = useUserType()
  const { open: openAppKit } = useAppKit()
  const { address: reownAddress, isConnected: isReownConnected } = useAppKitAccount()
  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showOffRampModal, setShowOffRampModal] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  const isConnected = isWeb3Connected || isReownConnected
  const activeAddress = reownAddress || wallets[activeChain]

  useEffect(() => {
    if (isReownConnected && !isWeb3Connected) {
      setUserType("web2")
    } else if (isWeb3Connected && !isReownConnected) {
      setUserType("web3")
    }
  }, [isReownConnected, isWeb3Connected, setUserType])

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

  const handleWeb2Login = () => {
    setShowLoginModal(false)
    setUserType("web2")
    openAppKit({ view: "Connect" })
  }

  const handleWeb3Connect = async (chain: "EVM" | "SOLANA" | "BITCOIN") => {
    setShowLoginModal(false)
    setUserType("web3")

    try {
      if (chain === "EVM") {
        if (isMobile) {
          handleMobileConnect()
        } else {
          await connectWallet()
        }
      }
    } catch (error) {
      console.error("Connection error:", error)
    }
  }

  const totalBalance = Number.parseFloat(usdtBalance) + Number.parseFloat(usdcBalance)
  const hasZeroBalance = totalBalance === 0

  if (!isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowLoginModal(true)}
          disabled={isConnecting}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4"
        >
          <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          <span className="hidden xs:inline">{isConnecting ? "Connecting..." : "Sign In"}</span>
          <span className="xs:hidden">{isConnecting ? "..." : "Sign In"}</span>
        </Button>

        <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl">Welcome to Protocol Banks</DialogTitle>
              <DialogDescription>Choose how you would like to access your account</DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <HelpCircle className="h-4 w-4" />
                  <span>New to digital currency? Start here</span>
                </div>

                <Button
                  variant="default"
                  className="w-full justify-start h-16 bg-primary hover:bg-primary/90"
                  onClick={handleWeb2Login}
                >
                  <div className="bg-white/20 p-2 rounded-full mr-4">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="font-semibold">Email or Social Login</span>
                    <span className="text-xs opacity-80">Google, Apple, Email - No crypto experience needed</span>
                  </div>
                  <ArrowRight className="ml-auto h-5 w-5" />
                </Button>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 text-green-500" />
                    <div>
                      <p className="font-medium text-foreground">Perfect for beginners</p>
                      <p>
                        Use your existing accounts. We handle the blockchain complexity so you can focus on your
                        business.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or for Web3 users</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                  <span>Already have a crypto wallet?</span>
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start h-14 bg-transparent"
                  onClick={() => handleWeb3Connect("EVM")}
                >
                  <div className="bg-orange-500/10 p-2 rounded-full mr-4">
                    <Wallet className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="font-semibold">Connect Wallet</span>
                    <span className="text-xs text-muted-foreground">MetaMask, WalletConnect, Coinbase</span>
                  </div>
                </Button>

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 mt-0.5 text-blue-500" />
                    <div>
                      <p className="font-medium text-foreground">Full control</p>
                      <p>Non-custodial access. You maintain complete control of your assets at all times.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
              onClick={() => {
                web3Disconnect()
              }}
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

        <DropdownMenuItem
          onClick={() => web3Disconnect()}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
