"use client"

/**
 * Authorization step for a subscription.
 *
 * A subscription cannot charge itself: the payer has to authorise the future
 * charges up front. There are two ways to do that, and which one applies is a
 * property of the chain, not a user choice:
 *
 *   - SubscriptionManager deployed — one transaction grants an allowance and
 *     registers the terms on-chain, which then caps every later charge.
 *   - Otherwise — the payer signs one ERC-3009 authorization per period, since
 *     an ERC-3009 nonce is single-use and cannot cover a recurring charge.
 *
 * The second path prompts the wallet once per period, so progress is surfaced
 * rather than leaving the user staring at repeated wallet popups.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import {
  authorizeSubscriptionPeriods,
  createOnChainMandate,
  fetchAuthorizationPlan,
  linkOnChainSubscription,
} from "@/lib/subscription-authorization"
import {
  frequencyToSeconds,
  getSubscriptionManagerAddress,
  isSubscriptionManagerDeployed,
} from "@/lib/services/subscription-manager-contract"
import { getNetworkById } from "@/lib/networks"
import { AlertTriangle, Info, Loader2 } from "lucide-react"

const PERIOD_OPTIONS = [6, 12, 24]

/**
 * How long before a charge executes the payer is warned.
 *
 * This window is what makes cancellation safe: while it is running the charge
 * cannot execute, so a payer who cancels is not racing a merchant watching the
 * mempool. Only applies on the contract path.
 */
const NOTICE_OPTIONS = [
  { value: 0, label: "No notice — charge immediately" },
  { value: 24 * 60 * 60, label: "1 day before each charge" },
  { value: 3 * 24 * 60 * 60, label: "3 days before each charge" },
  { value: 7 * 24 * 60 * 60, label: "7 days before each charge" },
]

interface AuthorizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: {
    id: string
    service_name: string
    amount: string
    token: string
    frequency: string
    /** Chain name as stored on the subscription (e.g. "arbitrum"). */
    chain: string
    recipient_address: string
  } | null
  onAuthorized?: () => void
}

function truncate(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

function periodNoun(frequency: string, count: number) {
  const base =
    frequency === "daily"
      ? "day"
      : frequency === "weekly"
        ? "week"
        : frequency === "yearly"
          ? "year"
          : "month"
  return count === 1 ? base : `${base}s`
}

export function AuthorizeDialog({
  open,
  onOpenChange,
  subscription,
  onAuthorized,
}: AuthorizeDialogProps) {
  const { address, chainId, signer, signERC3009Authorization } = useUnifiedWallet()
  const { toast } = useToast()

  const [periods, setPeriods] = useState(12)
  const [noticeSeconds, setNoticeSeconds] = useState(24 * 60 * 60)
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState(0)

  if (!subscription) return null

  // The subscription's own chain, which is not necessarily the one the wallet is
  // currently on. Unknown chain names resolve to no config, which means no
  // contract — the per-period signing path is then the correct fallback.
  const subscriptionChainId = getNetworkById(subscription.chain)?.chainId
  const onChain = subscriptionChainId
    ? isSubscriptionManagerDeployed(subscriptionChainId)
    : false
  const amount = Number(subscription.amount)
  const maxTotal = (amount * periods).toFixed(2)

  const reset = () => {
    setBusy(false)
    setSigned(0)
  }

  /**
   * Contract path: one transaction establishes the allowance and the mandate.
   *
   * The mandate is linked only after the transaction confirms, and a failure to
   * link is surfaced rather than swallowed — an unlinked mandate exists on-chain
   * but would never be charged, which is worse than a clean failure.
   */
  const authorizeViaContract = async () => {
    if (!subscriptionChainId) {
      throw new Error(`Unknown network for this subscription: ${subscription.chain}`)
    }

    // A permit signature is bound to a chain id. Signing on the wrong network
    // produces a signature the token contract will reject.
    if (chainId && chainId !== subscriptionChainId) {
      throw new Error(
        `Switch your wallet to ${subscription.chain} before authorizing — ` +
        `this subscription is on chain ${subscriptionChainId}, your wallet is on ${chainId}.`
      )
    }

    const managerAddress = getSubscriptionManagerAddress(subscriptionChainId)
    if (!managerAddress) {
      throw new Error(`No SubscriptionManager is deployed on chain ${subscriptionChainId}`)
    }
    if (!signer) throw new Error("Wallet is not ready to sign transactions")

    const plan = await fetchAuthorizationPlan(subscription.id, address!, 1)

    const { onchainSubscriptionId, txHash } = await createOnChainMandate({
      signer,
      managerAddress,
      plan,
      periods,
      periodSeconds: frequencyToSeconds(subscription.frequency),
      noticeSeconds,
    })

    try {
      await linkOnChainSubscription({
        subscriptionId: subscription.id,
        ownerAddress: address!,
        onchainSubscriptionId,
        txHash,
      })
    } catch (error: any) {
      throw new Error(
        `The mandate was created on-chain (${txHash}) but could not be linked: ` +
        `${error?.message || "unknown error"}. It will not be charged until it is linked.`
      )
    }

    toast({
      title: "Authorized",
      description: `${subscription.service_name} will be charged automatically for up to ${periods} ${periodNoun(subscription.frequency, periods)}.`,
    })
    onAuthorized?.()
    onOpenChange(false)
    reset()
  }

  const handleAuthorize = async () => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Connect the wallet that owns this subscription.",
        variant: "destructive",
      })
      return
    }

    setBusy(true)
    setSigned(0)

    try {
      if (onChain) {
        await authorizeViaContract()
        return
      }

      const { stored, total } = await authorizeSubscriptionPeriods({
        subscriptionId: subscription.id,
        ownerAddress: address,
        periods,
        signAuthorization: signERC3009Authorization as any,
        onProgress: (count) => setSigned(count),
      })

      if (total === 0) {
        toast({
          title: "Already authorized",
          description: "This subscription has no unauthorized periods.",
        })
      } else {
        toast({
          title: "Authorized",
          description: `${stored} ${periodNoun(subscription.frequency, stored)} of payments authorized.`,
        })
      }

      onAuthorized?.()
      onOpenChange(false)
      reset()
    } catch (error: any) {
      const message: string = error?.message || "Authorization failed"
      const rejected = /reject|denied|user cancel/i.test(message)

      toast({
        title: rejected ? "Authorization cancelled" : "Authorization failed",
        description: rejected
          ? "Nothing was saved. Payments stay paused until you authorize."
          : message,
        variant: "destructive",
      })
      setBusy(false)
      setSigned(0)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing mid-signing would leave the user unsure what was stored.
        if (busy) return
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Authorize {subscription.service_name}</DialogTitle>
          <DialogDescription>
            {amount.toFixed(2)} {subscription.token} · {subscription.frequency} · to{" "}
            <span className="font-mono">{truncate(subscription.recipient_address)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="periods">
              Authorize {periodNoun(subscription.frequency, 2)}
            </Label>
            <Select
              value={String(periods)}
              onValueChange={(v) => setPeriods(Number(v))}
              disabled={busy}
            >
              <SelectTrigger id="periods">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {periodNoun(subscription.frequency, n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Up to {maxTotal} {subscription.token} in total. This budget is
              reserved for this subscription alone.
            </p>
          </div>

          {onChain && (
            <div className="space-y-2">
              <Label htmlFor="notice">Advance notice</Label>
              <Select
                value={String(noticeSeconds)}
                onValueChange={(v) => setNoticeSeconds(Number(v))}
                disabled={busy}
              >
                <SelectTrigger id="notice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTICE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {noticeSeconds > 0
                  ? "Each charge is announced first, giving you time to cancel before it can go through."
                  : "Charges can execute as soon as they come due."}
              </p>
            </div>
          )}

          <div className="flex gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            {onChain ? (
              <p className="text-muted-foreground">
                One transaction. Nothing is charged now — each later charge is capped
                on-chain at {amount.toFixed(2)} {subscription.token} per{" "}
                {periodNoun(subscription.frequency, 1)}, stops after {periods}{" "}
                {periodNoun(subscription.frequency, periods)}, and you can cancel
                anytime.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Your wallet will ask for <strong>{periods} signatures</strong>, one per{" "}
                {periodNoun(subscription.frequency, 1)}. Nothing is charged now. Each
                signature only authorizes its own {periodNoun(subscription.frequency, 1)}.
              </p>
            )}
          </div>

          {busy && !onChain && (
            <div className="space-y-2">
              <Progress value={(signed / periods) * 100} className="h-2" />
              <p className="text-sm text-muted-foreground">
                {signed} / {periods} signed
                {signed < periods && " — check your wallet…"}
              </p>
            </div>
          )}

          {!busy && (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-muted-foreground">
                Until this is done, no payment for this subscription will run.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              reset()
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleAuthorize} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? "Signing…" : onChain ? "Authorize" : "Start signing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
