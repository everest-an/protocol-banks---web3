"use client"

import { SplitPaymentForm } from "@/components/split-payment-form"
import { useWeb3 } from "@/contexts/web3-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Info } from "lucide-react"

export default function SplitPaymentsPage() {
  const { address, isConnected } = useWeb3()

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold mb-2">Split Payments</h1>
        <p className="text-muted-foreground">
          Distribute funds to multiple recipients based on percentage allocation.
          Perfect for revenue sharing, payroll, and team expenses.
        </p>
      </div>

      {!isConnected ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Connect Wallet</AlertTitle>
          <AlertDescription>
            Please connect your wallet to use the split payment feature.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Split Payment</CardTitle>
              <CardDescription>
                Add recipients and set their percentage share. The total must equal 100%.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SplitPaymentForm 
                userAddress={address || ""} 
                onExecute={(result) => {
                  if (result.success) {
                    console.log("Split payment executed:", result.tx_hash)
                  }
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
