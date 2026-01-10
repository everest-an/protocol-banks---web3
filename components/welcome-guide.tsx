"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useWeb3 } from "@/contexts/web3-context"
import { useUserType } from "@/contexts/user-type-context"
import { Wallet, Send, Receipt, ArrowRight, CreditCard, Building2, Users, BarChart3 } from "lucide-react"

export function WelcomeGuide() {
  const { isConnected, wallet } = useWeb3()
  const { isWeb2User } = useUserType()
  const [showGuide, setShowGuide] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (isConnected && wallet) {
      // Check if user has seen the guide before
      const hasSeenGuide = localStorage.getItem(`welcome-guide-${wallet}`)
      if (!hasSeenGuide) {
        setShowGuide(true)
      }
    }
  }, [isConnected, wallet])

  const dismissGuide = () => {
    if (wallet) {
      localStorage.setItem(`welcome-guide-${wallet}`, "true")
    }
    setShowGuide(false)
  }

  const web2Steps = [
    {
      icon: CreditCard,
      title: "Add Funds",
      description:
        "Start by adding funds to your account using a credit card or bank transfer. Your money is converted to digital dollars.",
    },
    {
      icon: Send,
      title: "Send Money",
      description: "Send payments to anyone worldwide instantly. Just enter their account ID and amount.",
    },
    {
      icon: Receipt,
      title: "Receive Payments",
      description: "Generate payment links to receive funds from clients or customers easily.",
    },
    {
      icon: Building2,
      title: "Withdraw Anytime",
      description: "Convert your digital dollars back to cash and withdraw to your bank account whenever you need.",
    },
  ]

  const web3Steps = [
    {
      icon: Wallet,
      title: "Wallet Connected",
      description: "Your wallet is now connected. You can view balances and manage multiple chains.",
    },
    {
      icon: Send,
      title: "Batch Payments",
      description: "Send USDT/USDC to multiple recipients in a single transaction with EIP-3009 authorization.",
    },
    {
      icon: Users,
      title: "Wallet Tags",
      description: "Tag wallet addresses with names and categories for easier tracking and analysis.",
    },
    {
      icon: BarChart3,
      title: "Analytics",
      description: "View detailed payment history, export reports, and analyze your spending patterns.",
    },
  ]

  const steps = isWeb2User ? web2Steps : web3Steps

  return (
    <Dialog open={showGuide} onOpenChange={setShowGuide}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {currentStep === 0
              ? isWeb2User
                ? "Welcome to Protocol Banks!"
                : "Welcome, Web3 User!"
              : steps[currentStep - 1]?.title}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 0
              ? isWeb2User
                ? "Your digital banking experience starts here. Let's show you around."
                : "Your wallet is connected. Here's what you can do."
              : steps[currentStep - 1]?.description}
          </DialogDescription>
        </DialogHeader>

        {currentStep === 0 ? (
          <div className="grid grid-cols-2 gap-3 py-4">
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center p-4 rounded-lg bg-secondary/30 text-center">
                <step.icon className="h-8 w-8 text-primary mb-2" />
                <span className="text-sm font-medium">{step.title}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8">
            {(() => {
              const StepIcon = steps[currentStep - 1]?.icon
              return StepIcon ? <StepIcon className="h-16 w-16 text-primary mb-4" /> : null
            })()}
          </div>
        )}

        <div className="flex justify-between items-center pt-4">
          <div className="flex gap-1">
            {[0, ...steps.map((_, i) => i + 1)].map((step) => (
              <div
                key={step}
                className={`h-2 w-2 rounded-full transition-colors ${step === currentStep ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={dismissGuide}>
              Skip
            </Button>
            {currentStep < steps.length ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={dismissGuide}>Get Started</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
