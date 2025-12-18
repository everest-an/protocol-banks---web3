"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { useAppKit, useAppKitAccount } from "@reown/appkit/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Wallet,
  LogOut,
  Copy,
  CheckCircle,
  AlertTriangle,
  Bitcoin,
  Mail,
  CreditCard,
  User,
  HelpCircle,
  DollarSign,
  Shield,
  ArrowRight,
} from "lucide-react"
import { useState, useEffect } from "react"
import { CHAIN_IDS, isMobileDevice, getMetaMaskDeepLink } from "@/lib/web3"
import { useToast } from "@/hooks/use-toast"

export function UnifiedWalletButton() {
  const {
    wallets,
    activeChain,
    setActiveChain,
    isConnected: isWeb3Connected,
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

  const { userType, setUserType, isWeb2User, getLabel } = useUserType()
  const { open: openReown } = useAppKit()
  const { address: reownAddress, isConnected: isReownConnected } = useAppKitAccount()
  const { toast } = useToast()

  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    setIsMobile(isMobileDevice())
  }, [])

  // Determine overall connection status
  const isConnected = isWeb3Connected || isReownConnected
  const activeAddress = reownAddress || wallets[activeChain]

  // Auto-detect user type based on connection method
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
    openReown()
  }

  const handleWeb3Connect = async (chain: "EVM" | "SOLANA" | "BITCOIN") => {
    setShowLoginModal(false)
    setUserType("web3")

    try {
      await connectWallet(chain)
    } catch (error: any) {
      // Handle user rejection gracefully - this is not an error
      if (error?.message?.includes("rejected") || error?.message?.includes("denied") || error?.code === 4001) {
        toast({
          title: "Connection Cancelled",
          description: "You cancelled the wallet connection. Click Sign In to try again.",
          variant: "default",
        })
      } else if (error?.message?.includes("not installed") || error?.message?.includes("not found")) {
        toast({
          title: "Wallet Not Found",
          description: `Please install a ${chain} wallet extension to continue.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Connection Failed",
          description: "Unable to connect wallet. Please try again.",
          variant: "destructive",
        })
      }
      // Reset user type if connection failed
      setUserType(null)
    }
  }

  const handleDisconnect = () => {
    if (isReownConnected) {
      openReown({ view: "Account" })
    }
    if (isWeb3Connected) {
      disconnectWallet()
    }
    setUserType(null)
  }

  const handleBuyCrypto = () => {
    openReown({ view: "OnRampProviders" })
  }

  // Not connected - show login options
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
              {/* Web2 Section - For beginners */}
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
                        We&apos;ll create a secure digital account for you automatically. You can add funds using your
                        credit card or bank transfer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or for crypto users</span>
                </div>
              </div>

              {/* Web3 Section - For crypto users */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  <span>Already have a crypto wallet?</span>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-start h-14 bg-transparent hover:bg-accent"
                    onClick={() => handleWeb3Connect("EVM")}
                  >
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full mr-4">
                      <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Ethereum / EVM</span>
                      <span className="text-xs text-muted-foreground">MetaMask, Rainbow, Coinbase</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-14 bg-transparent hover:bg-accent"
                    onClick={() => handleWeb3Connect("SOLANA")}
                  >
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full mr-4">
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Solana</span>
                      <span className="text-xs text-muted-foreground">Phantom, Solflare</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="justify-start h-14 bg-transparent hover:bg-accent"
                    onClick={() => handleWeb3Connect("BITCOIN")}
                  >
                    <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-full mr-4">
                      <Bitcoin className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Bitcoin</span>
                      <span className="text-xs text-muted-foreground">Unisat, Xverse</span>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Connected but wrong network (only for EVM Web3 users)
  if (userType === "web3" && activeChain === "EVM" && wallets.EVM && !isSupportedNetwork) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="destructive" size="sm" className="text-xs sm:text-sm px-2 sm:px-4">
            <AlertTriangle className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Wrong Network</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => switchNetwork(CHAIN_IDS.MAINNET)}>Switch to Mainnet</DropdownMenuItem>
          <DropdownMenuItem onClick={() => switchNetwork(CHAIN_IDS.SEPOLIA)}>Switch to Sepolia (Test)</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  // Connected state - different UI for Web2 vs Web3
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
          {isWeb2User ? (
            <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          ) : activeChain === "BITCOIN" ? (
            <Bitcoin className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
          ) : activeChain === "SOLANA" ? (
            <div className="mr-1 sm:mr-2 h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-purple-500" />
          ) : (
            <Wallet className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
          )}
          <span className="hidden xs:inline truncate max-w-[80px] sm:max-w-none">
            {activeAddress ? formatAddress(activeAddress) : isWeb2User ? "My Account" : "Connected"}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 bg-card border-border">
        {/* Web2 User UI - Simplified */}
        {isWeb2User ? (
          <>
            <DropdownMenuLabel className="text-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                My Account
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />

            {/* Simplified balance display */}
            <div className="px-3 py-3 space-y-2">
              <div className="text-xs text-muted-foreground mb-2">Your Balance</div>
              <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Digital Dollars</span>
                  </div>
                  <span className="font-mono font-semibold">
                    ${(Number.parseFloat(usdtBalance) + Number.parseFloat(usdcBalance)).toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-2">
                Your digital dollars work just like regular money, but can be sent anywhere in the world instantly.
              </p>
            </div>

            <DropdownMenuSeparator className="bg-border" />

            {/* Web2-friendly actions */}
            <DropdownMenuItem onClick={handleBuyCrypto} className="cursor-pointer">
              <CreditCard className="mr-2 h-4 w-4 text-green-500" />
              <div className="flex flex-col">
                <span>Add Funds</span>
                <span className="text-xs text-muted-foreground">Use card or bank transfer</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => openReown({ view: "Account" })} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Account Settings
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => activeAddress && copyAddress(activeAddress)} className="cursor-pointer">
              {copied ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Account ID
                </>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-red-500 focus:text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </>
        ) : (
          /* Web3 User UI - Technical */
          <>
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

            <DropdownMenuItem onClick={() => activeAddress && copyAddress(activeAddress)} className="cursor-pointer">
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

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-red-500 focus:text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect Wallet
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
