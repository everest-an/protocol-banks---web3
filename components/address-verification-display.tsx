"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Shield, ShieldAlert, ShieldCheck, Copy, Check, Eye, RefreshCw, AlertTriangle } from "lucide-react"
import {
  generateVisualAddressChunks,
  generateAddressChecksum,
  ClipboardMonitor,
  type ClipboardSecurityResult,
} from "@/lib/security/future-attack-protection"
import { useToast } from "@/hooks/use-toast"

interface AddressVerificationDisplayProps {
  address: string
  label?: string
  showQrCode?: boolean
  onVerificationComplete?: (isSecure: boolean) => void
}

export function AddressVerificationDisplay({
  address,
  label = "Recipient Address",
  showQrCode = true,
  onVerificationComplete,
}: AddressVerificationDisplayProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [clipboardMonitor] = useState(() => new ClipboardMonitor())
  const [verificationResult, setVerificationResult] = useState<ClipboardSecurityResult | null>(null)
  const [showVerification, setShowVerification] = useState(false)

  const chunkedAddress = generateVisualAddressChunks(address)
  const checksum = generateAddressChecksum(address)

  useEffect(() => {
    return () => {
      clipboardMonitor.destroy()
    }
  }, [clipboardMonitor])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      await clipboardMonitor.recordCopy(address)
      setCopied(true)
      setShowVerification(true)

      toast({
        title: "Address Copied",
        description: "Click 'Verify Clipboard' before pasting to ensure security.",
      })

      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy address to clipboard",
        variant: "destructive",
      })
    }
  }

  const handleVerify = async () => {
    const result = await clipboardMonitor.verifyClipboard()
    setVerificationResult(result)
    onVerificationComplete?.(result.isSecure)

    if (!result.isSecure) {
      toast({
        title: "Security Warning",
        description: result.modificationDetails || "Clipboard content has been modified!",
        variant: "destructive",
      })
    } else {
      toast({
        title: "Clipboard Verified",
        description: "Address in clipboard matches original. Safe to paste.",
      })
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {label}
          </span>
          <Badge variant="outline" className="font-mono text-xs">
            {checksum}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chunked Address Display */}
        <div className="p-3 bg-muted rounded-lg">
          <p className="font-mono text-sm tracking-wide text-center">{chunkedAddress}</p>
        </div>

        {/* Visual Checksum Explanation */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Eye className="h-3 w-3" />
          <span>
            Visual Checksum: <span className="font-mono font-medium">{checksum}</span>
          </span>
        </div>

        {/* Copy and Verify Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy Address
              </>
            )}
          </Button>

          {showVerification && (
            <Button variant="default" className="flex-1" onClick={handleVerify}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Verify Clipboard
            </Button>
          )}
        </div>

        {/* Verification Result */}
        {verificationResult && (
          <Alert
            variant={verificationResult.isSecure ? "default" : "destructive"}
            className={verificationResult.isSecure ? "bg-green-500/10 border-green-500/30" : ""}
          >
            {verificationResult.isSecure ? (
              <ShieldCheck className="h-4 w-4 text-green-500" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            <AlertTitle>{verificationResult.isSecure ? "Clipboard Secure" : "Security Alert"}</AlertTitle>
            <AlertDescription className="text-sm">
              {verificationResult.isSecure
                ? "The address in your clipboard matches the original. Safe to paste."
                : verificationResult.modificationDetails ||
                  "Clipboard content has been modified. Do NOT paste this address!"}
            </AlertDescription>
          </Alert>
        )}

        {/* Security Tips */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
            <strong>Clipboard Hijacking Protection:</strong>
          </p>
          <ul className="list-disc list-inside pl-4 space-y-0.5">
            <li>
              Always verify the checksum (<span className="font-mono">{checksum}</span>) matches
            </li>
            <li>Click "Verify Clipboard" before pasting to another app</li>
            <li>Compare the first 6 and last 4 characters visually</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
