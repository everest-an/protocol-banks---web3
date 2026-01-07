"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Fingerprint, Loader2, ShieldCheck, AlertCircle } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"

interface BiometricVerifyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onVerified: () => void
  onCancel: () => void
  title?: string
  description?: string
}

export function BiometricVerify({
  open,
  onOpenChange,
  onVerified,
  onCancel,
  title = "Verify Your Identity",
  description = "Use Face ID or fingerprint to confirm this transaction",
}: BiometricVerifyProps) {
  const isMobile = useMediaQuery("(max-width: 768px)")
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleVerify = async () => {
    setStatus("verifying")
    setErrorMessage("")

    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        throw new Error("Biometric authentication not supported")
      }

      // Check for platform authenticator
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      if (!available) {
        throw new Error("No biometric authenticator available")
      }

      // Create credential request
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          timeout: 60000,
          userVerification: "required",
          rpId: window.location.hostname,
        },
      })

      if (credential) {
        setStatus("success")
        setTimeout(() => {
          onVerified()
          onOpenChange(false)
          setStatus("idle")
        }, 500)
      } else {
        throw new Error("Verification cancelled")
      }
    } catch (error: any) {
      setStatus("error")
      setErrorMessage(error.message || "Verification failed")
    }
  }

  const handleSkip = () => {
    onCancel()
    onOpenChange(false)
    setStatus("idle")
  }

  const Content = () => (
    <div className="flex flex-col items-center py-6">
      <div
        className={`h-24 w-24 rounded-full flex items-center justify-center mb-6 transition-colors ${
          status === "success" ? "bg-green-500/10" : status === "error" ? "bg-destructive/10" : "bg-primary/10"
        }`}
      >
        {status === "verifying" ? (
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        ) : status === "success" ? (
          <ShieldCheck className="h-12 w-12 text-green-500" />
        ) : status === "error" ? (
          <AlertCircle className="h-12 w-12 text-destructive" />
        ) : (
          <Fingerprint className="h-12 w-12 text-primary" />
        )}
      </div>

      {status === "error" && <p className="text-sm text-destructive text-center mb-4">{errorMessage}</p>}

      <div className="flex flex-col gap-2 w-full max-w-xs">
        {status !== "success" && (
          <>
            <Button onClick={handleVerify} disabled={status === "verifying"} className="w-full">
              {status === "verifying" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : status === "error" ? (
                "Try Again"
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Verify with Biometrics
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={handleSkip} disabled={status === "verifying"}>
              Skip Verification
            </Button>
          </>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <Content />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Content />
      </DialogContent>
    </Dialog>
  )
}
