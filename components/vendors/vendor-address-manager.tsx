"use client"

/**
 * Vendor Address Manager Component
 * Manages multi-network addresses for a vendor
 */

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ALL_NETWORKS } from "@/lib/networks"
import { validateAddress, detectAddressType } from "@/lib/address-utils"
import { Trash2, Plus, Edit, Star, StarOff, Check, X } from "lucide-react"
import { authHeaders } from "@/lib/authenticated-fetch"

interface VendorAddress {
  id: string
  network: string
  address: string
  label?: string
  isPrimary: boolean
  verifiedAt?: string
  createdAt: string
}

interface VendorAddressManagerProps {
  vendorId: string
  addresses: VendorAddress[]
  onUpdate: () => void
  userAddress: string
}

export function VendorAddressManager({
  vendorId,
  addresses: initialAddresses,
  onUpdate,
  userAddress,
}: VendorAddressManagerProps) {
  const [addresses, setAddresses] = useState<VendorAddress[]>(initialAddresses)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<VendorAddress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state for new address
  const [newAddress, setNewAddress] = useState({
    network: "",
    address: "",
    label: "",
    isPrimary: false,
  })

  // Form state for editing
  const [editForm, setEditForm] = useState({
    label: "",
    isPrimary: false,
  })

  useEffect(() => {
    setAddresses(initialAddresses)
  }, [initialAddresses])

  // Auto-detect network from address
  const handleAddressChange = (address: string) => {
    setNewAddress(prev => ({ ...prev, address }))

    if (address.trim()) {
      const validation = validateAddress(address)
      if (validation.isValid) {
        const type = detectAddressType(address)
        if (type === "TRON") {
          setNewAddress(prev => ({ ...prev, network: "tron" }))
        } else if (type === "EVM") {
          // Default to ethereum for EVM addresses
          setNewAddress(prev => ({ ...prev, network: "ethereum" }))
        }
      }
    }
  }

  // Add new address
  const handleAddAddress = async () => {
    try {
      setLoading(true)
      setError(null)

      const validation = validateAddress(newAddress.address)
      if (!validation.isValid) {
        setError(validation.error || "Invalid address")
        return
      }

      if (!newAddress.network) {
        setError("Please select a network")
        return
      }

      const response = await fetch(`/api/vendors/${vendorId}/addresses`, {
        method: "POST",
        headers: authHeaders(userAddress, { contentType: "application/json" }),
        body: JSON.stringify({
          network: newAddress.network,
          address: validation.checksumAddress || newAddress.address,
          label: newAddress.label.trim() || undefined,
          isPrimary: newAddress.isPrimary,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add address")
      }

      // Update local state
      setAddresses(prev => [...prev, data.address])

      // Reset form
      setNewAddress({
        network: "",
        address: "",
        label: "",
        isPrimary: false,
      })

      setIsAddDialogOpen(false)
      onUpdate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Update address
  const handleUpdateAddress = async () => {
    if (!editingAddress) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/vendors/${vendorId}/addresses/${editingAddress.id}`,
        {
          method: "PATCH",
          headers: authHeaders(userAddress, { contentType: "application/json" }),
          body: JSON.stringify({
            label: editForm.label.trim() || undefined,
            isPrimary: editForm.isPrimary,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update address")
      }

      // Update local state
      setAddresses(prev =>
        prev.map(addr => (addr.id === editingAddress.id ? data.address : addr))
      )

      setIsEditDialogOpen(false)
      setEditingAddress(null)
      onUpdate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Delete address
  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/vendors/${vendorId}/addresses/${addressId}`,
        {
          method: "DELETE",
          headers: authHeaders(userAddress),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete address")
      }

      // Update local state
      setAddresses(prev => prev.filter(addr => addr.id !== addressId))
      onUpdate()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Open edit dialog
  const openEditDialog = (address: VendorAddress) => {
    setEditingAddress(address)
    setEditForm({
      label: address.label || "",
      isPrimary: address.isPrimary,
    })
    setIsEditDialogOpen(true)
  }

  // Get network name
  const getNetworkName = (network: string) => {
    return ALL_NETWORKS[network]?.name || network.toUpperCase()
  }

  // Get network color
  const getNetworkColor = (network: string) => {
    if (network === "tron" || network === "tron-nile") return "bg-red-500"
    if (network === "ethereum" || network === "sepolia") return "bg-blue-500"
    if (network === "base") return "bg-blue-600"
    if (network === "arbitrum") return "bg-cyan-500"
    if (network === "bsc") return "bg-yellow-500"
    return "bg-gray-500"
  }

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Network Addresses</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Network Address</DialogTitle>
              <DialogDescription>
                Add a new wallet address for this vendor on another network.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input
                  id="address"
                  placeholder="0x... or T..."
                  value={newAddress.address}
                  onChange={e => handleAddressChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Network will be auto-detected from address format
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="network">Network</Label>
                <Select
                  value={newAddress.network}
                  onValueChange={network =>
                    setNewAddress(prev => ({ ...prev, network }))
                  }
                >
                  <SelectTrigger id="network">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ALL_NETWORKS).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label (Optional)</Label>
                <Input
                  id="label"
                  placeholder="e.g., Main TRON wallet"
                  value={newAddress.label}
                  onChange={e =>
                    setNewAddress(prev => ({ ...prev, label: e.target.value }))
                  }
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={newAddress.isPrimary}
                  onChange={e =>
                    setNewAddress(prev => ({ ...prev, isPrimary: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isPrimary" className="font-normal">
                  Set as primary address for this network
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleAddAddress} disabled={loading}>
                {loading ? "Adding..." : "Add Address"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Address List */}
      <div className="space-y-2">
        {addresses.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No addresses added yet. Click "Add Address" to get started.
          </div>
        ) : (
          addresses.map(address => (
            <div
              key={address.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center space-x-4">
                {/* Network Badge */}
                <Badge
                  className={`${getNetworkColor(address.network)} text-white`}
                >
                  {getNetworkName(address.network)}
                </Badge>

                {/* Address Info */}
                <div>
                  <div className="flex items-center space-x-2">
                    <code className="text-sm font-mono">
                      {formatAddress(address.address)}
                    </code>
                    {address.isPrimary && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                    {address.verifiedAt && (
                      <Check className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  {address.label && (
                    <p className="text-sm text-muted-foreground">
                      {address.label}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(address)}
                  disabled={loading}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteAddress(address.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Address</DialogTitle>
            <DialogDescription>
              Update the label or primary status for this address.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {editingAddress && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">
                  {getNetworkName(editingAddress.network)}
                </p>
                <code className="text-xs font-mono text-muted-foreground">
                  {editingAddress.address}
                </code>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-label">Label (Optional)</Label>
              <Input
                id="edit-label"
                placeholder="e.g., Main TRON wallet"
                value={editForm.label}
                onChange={e =>
                  setEditForm(prev => ({ ...prev, label: e.target.value }))
                }
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isPrimary"
                checked={editForm.isPrimary}
                onChange={e =>
                  setEditForm(prev => ({ ...prev, isPrimary: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="edit-isPrimary" className="font-normal">
                Set as primary address for this network
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateAddress} disabled={loading}>
              {loading ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
