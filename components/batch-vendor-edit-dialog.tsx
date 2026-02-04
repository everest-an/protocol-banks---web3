"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Vendor } from "@/types/vendor"

interface BatchVendorEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendors: Vendor[]
  onSubmit: (updates: Array<{ id: string; name: string }>) => Promise<void>
}

export function BatchVendorEditDialog({ open, onOpenChange, vendors, onSubmit }: BatchVendorEditDialogProps) {
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    vendors.forEach((v) => {
      initial[v.id] = v.name || v.company_name || ""
    })
    return initial
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    const updates = vendors
      .filter((v) => {
        const newName = edits[v.id]?.trim()
        const oldName = v.name || v.company_name || ""
        return newName && newName !== oldName
      })
      .map((v) => ({ id: v.id, name: edits[v.id].trim() }))

    if (updates.length === 0) {
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(updates)
    } finally {
      setSubmitting(false)
    }
  }

  const changedCount = vendors.filter((v) => {
    const newName = edits[v.id]?.trim()
    const oldName = v.name || v.company_name || ""
    return newName && newName !== oldName
  }).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Batch Edit Names</DialogTitle>
          <DialogDescription>
            Edit names for {vendors.length} selected contact{vendors.length > 1 ? "s" : ""}. Only changed names will be updated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {vendors.map((vendor) => {
            const shortAddr = `${vendor.wallet_address.substring(0, 6)}...${vendor.wallet_address.substring(38)}`
            return (
              <div key={vendor.id} className="space-y-1">
                <Label className="text-xs text-muted-foreground font-mono">{shortAddr}</Label>
                <Input
                  value={edits[vendor.id] || ""}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                  placeholder="Contact name"
                />
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || changedCount === 0}>
            {submitting ? "Updating..." : `Update ${changedCount} Name${changedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
