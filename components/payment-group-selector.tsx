"use client"

import { useState } from "react"
import { usePaymentGroups } from "@/hooks/use-payment-groups"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PurposeTagSelector } from "@/components/purpose-tag-selector"
import { Plus, FolderOpen } from "lucide-react"
import { authHeaders } from "@/lib/authenticated-fetch"

interface PaymentGroupSelectorProps {
  ownerAddress: string
  value?: string
  onChange: (groupId: string | undefined) => void
}

export function PaymentGroupSelector({ ownerAddress, value, onChange }: PaymentGroupSelectorProps) {
  const { groups, setGroups, loading } = usePaymentGroups(ownerAddress)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [newGroupPurpose, setNewGroupPurpose] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!newGroupName.trim() || !ownerAddress) return
    setCreating(true)
    try {
      const res = await fetch("/api/payment-groups", {
        method: "POST",
        headers: authHeaders(ownerAddress, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: newGroupName.trim(),
          owner_address: ownerAddress,
          purpose: newGroupPurpose || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setGroups((prev) => [data.group, ...prev])
        onChange(data.group.id)
        setShowCreateDialog(false)
        setNewGroupName("")
        setNewGroupPurpose("")
      }
    } catch {
      // silently fail
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Select
          value={value || "none"}
          onValueChange={(v) => {
            if (v === "new") {
              setShowCreateDialog(true)
            } else if (v === "none") {
              onChange(undefined)
            } else {
              onChange(v)
            }
          }}
        >
          <SelectTrigger className="flex-1">
            <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder={loading ? "Loading..." : "No group"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No group</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
                {g.purpose ? ` (${g.purpose})` : ""}
              </SelectItem>
            ))}
            <SelectItem value="new">
              <span className="flex items-center gap-1">
                <Plus className="h-3 w-3" /> Create New Group
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Payment Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="e.g., January Salary"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Purpose (optional)</Label>
              <PurposeTagSelector
                value={newGroupPurpose}
                onChange={setNewGroupPurpose}
                showCustomInput={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newGroupName.trim()}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
