/**
 * Vendor Multi-Network Service
 * Handles vendor management with multi-network address support
 */

import { prisma } from "@/lib/prisma"
import { validateAddress, detectAddressType } from "@/lib/address-utils"

export interface VendorAddress {
  id: string
  network: string
  address: string
  label?: string | null
  isPrimary: boolean
  verifiedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface VendorWithAddresses {
  id: string
  name: string
  ownerAddress: string
  companyName?: string | null
  email?: string | null
  category?: string | null
  tags: string[]
  addresses: VendorAddress[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Create a new vendor with multi-network addresses
 */
export async function createVendorWithAddresses(params: {
  name: string
  ownerAddress: string
  addresses: Array<{
    network: string
    address: string
    label?: string
    isPrimary?: boolean
  }>
  companyName?: string
  email?: string
  category?: string
  tags?: string[]
}): Promise<VendorWithAddresses> {
  const { name, ownerAddress, addresses, companyName, email, category, tags = [] } = params

  // Validate all addresses
  for (const addr of addresses) {
    const validation = validateAddress(addr.address)
    if (!validation.isValid) {
      throw new Error(`Invalid address for ${addr.network}: ${validation.error}`)
    }

    // Auto-detect network type if not matching
    const detectedType = detectAddressType(addr.address)
    const expectedType = addr.network.startsWith("tron") ? "TRON" : "EVM"

    if (detectedType !== expectedType) {
      throw new Error(`Address ${addr.address} does not match network ${addr.network}`)
    }
  }

  // Ensure at least one primary address
  const hasPrimary = addresses.some((a) => a.isPrimary)
  if (!hasPrimary && addresses.length > 0) {
    addresses[0].isPrimary = true
  }

  // Set primary address for backward compatibility
  const primaryAddress = addresses.find((a) => a.isPrimary) || addresses[0]

  const vendor = await prisma.vendor.create({
    data: {
      name,
      ownerAddress,
      walletAddress: primaryAddress?.address || "",
      chain: primaryAddress?.network || "ethereum",
      companyName,
      email,
      category,
      tags,
      addresses: {
        create: addresses.map((addr) => ({
          network: addr.network,
          address: addr.address,
          label: addr.label,
          isPrimary: addr.isPrimary || false,
        })),
      },
    },
    include: {
      addresses: true,
    },
  })

  return {
    id: vendor.id,
    name: vendor.name,
    ownerAddress: vendor.ownerAddress,
    companyName: vendor.companyName,
    email: vendor.email,
    category: vendor.category,
    tags: vendor.tags,
    addresses: vendor.addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      label: a.label,
      isPrimary: a.isPrimary,
      verifiedAt: a.verifiedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }
}

/**
 * Get vendor with all network addresses
 */
export async function getVendorWithAddresses(vendorId: string, ownerAddress: string): Promise<VendorWithAddresses | null> {
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: vendorId,
      ownerAddress,
    },
    include: {
      addresses: {
        orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
      },
    },
  })

  if (!vendor) return null

  return {
    id: vendor.id,
    name: vendor.name,
    ownerAddress: vendor.ownerAddress,
    companyName: vendor.companyName,
    email: vendor.email,
    category: vendor.category,
    tags: vendor.tags,
    addresses: vendor.addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      label: a.label,
      isPrimary: a.isPrimary,
      verifiedAt: a.verifiedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }
}

/**
 * Get all vendors for a user with their addresses
 */
export async function listVendorsWithAddresses(ownerAddress: string): Promise<VendorWithAddresses[]> {
  const vendors = await prisma.vendor.findMany({
    where: { ownerAddress },
    include: {
      addresses: {
        orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  })

  return vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    ownerAddress: vendor.ownerAddress,
    companyName: vendor.companyName,
    email: vendor.email,
    category: vendor.category,
    tags: vendor.tags,
    addresses: vendor.addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      label: a.label,
      isPrimary: a.isPrimary,
      verifiedAt: a.verifiedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }))
}

/**
 * Add address to existing vendor
 */
export async function addVendorAddress(
  vendorId: string,
  ownerAddress: string,
  params: {
    network: string
    address: string
    label?: string
    isPrimary?: boolean
  }
): Promise<VendorAddress> {
  // Verify ownership
  const vendor = await prisma.vendor.findFirst({
    where: { id: vendorId, ownerAddress },
  })

  if (!vendor) {
    throw new Error("Vendor not found")
  }

  // Validate address
  const validation = validateAddress(params.address)
  if (!validation.isValid) {
    throw new Error(`Invalid address: ${validation.error}`)
  }

  // Check if address already exists for this network
  const existing = await prisma.vendorAddress.findUnique({
    where: {
      vendorId_network: {
        vendorId,
        network: params.network,
      },
    },
  })

  if (existing) {
    throw new Error(`Address already exists for network ${params.network}`)
  }

  // If setting as primary, unset other primary addresses for this network
  if (params.isPrimary) {
    await prisma.vendorAddress.updateMany({
      where: {
        vendorId,
        network: params.network,
      },
      data: {
        isPrimary: false,
      },
    })
  }

  const address = await prisma.vendorAddress.create({
    data: {
      vendorId,
      network: params.network,
      address: params.address,
      label: params.label,
      isPrimary: params.isPrimary || false,
    },
  })

  // Update vendor's primary address if this is primary
  if (params.isPrimary) {
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        walletAddress: params.address,
        chain: params.network,
      },
    })
  }

  return {
    id: address.id,
    network: address.network,
    address: address.address,
    label: address.label,
    isPrimary: address.isPrimary,
    verifiedAt: address.verifiedAt,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  }
}

/**
 * Update vendor address
 */
export async function updateVendorAddress(
  addressId: string,
  ownerAddress: string,
  params: {
    label?: string
    isPrimary?: boolean
  }
): Promise<VendorAddress> {
  // Get address with vendor ownership check
  const existingAddress = await prisma.vendorAddress.findFirst({
    where: {
      id: addressId,
      vendor: {
        ownerAddress,
      },
    },
    include: {
      vendor: true,
    },
  })

  if (!existingAddress) {
    throw new Error("Address not found")
  }

  // If setting as primary, unset others for this network
  if (params.isPrimary) {
    await prisma.vendorAddress.updateMany({
      where: {
        vendorId: existingAddress.vendorId,
        network: existingAddress.network,
        id: { not: addressId },
      },
      data: {
        isPrimary: false,
      },
    })

    // Update vendor's primary address
    await prisma.vendor.update({
      where: { id: existingAddress.vendorId },
      data: {
        walletAddress: existingAddress.address,
        chain: existingAddress.network,
      },
    })
  }

  const updated = await prisma.vendorAddress.update({
    where: { id: addressId },
    data: {
      label: params.label,
      isPrimary: params.isPrimary,
    },
  })

  return {
    id: updated.id,
    network: updated.network,
    address: updated.address,
    label: updated.label,
    isPrimary: updated.isPrimary,
    verifiedAt: updated.verifiedAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }
}

/**
 * Delete vendor address
 */
export async function deleteVendorAddress(addressId: string, ownerAddress: string): Promise<void> {
  const address = await prisma.vendorAddress.findFirst({
    where: {
      id: addressId,
      vendor: {
        ownerAddress,
      },
    },
  })

  if (!address) {
    throw new Error("Address not found")
  }

  // Don't allow deleting the last address
  const addressCount = await prisma.vendorAddress.count({
    where: { vendorId: address.vendorId },
  })

  if (addressCount <= 1) {
    throw new Error("Cannot delete the last address")
  }

  // If deleting primary, set another as primary
  if (address.isPrimary) {
    const replacement = await prisma.vendorAddress.findFirst({
      where: {
        vendorId: address.vendorId,
        id: { not: addressId },
      },
    })

    if (replacement) {
      await prisma.vendorAddress.update({
        where: { id: replacement.id },
        data: { isPrimary: true },
      })

      await prisma.vendor.update({
        where: { id: address.vendorId },
        data: {
          walletAddress: replacement.address,
          chain: replacement.network,
        },
      })
    }
  }

  await prisma.vendorAddress.delete({
    where: { id: addressId },
  })
}

/**
 * Get vendor address for specific network
 */
export async function getVendorAddressForNetwork(
  vendorId: string,
  network: string,
  ownerAddress: string
): Promise<VendorAddress | null> {
  const address = await prisma.vendorAddress.findFirst({
    where: {
      vendorId,
      network,
      vendor: {
        ownerAddress,
      },
    },
  })

  if (!address) return null

  return {
    id: address.id,
    network: address.network,
    address: address.address,
    label: address.label,
    isPrimary: address.isPrimary,
    verifiedAt: address.verifiedAt,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  }
}

/**
 * Get vendor by address (any network)
 */
export async function getVendorByAddress(address: string, ownerAddress: string): Promise<VendorWithAddresses | null> {
  const vendorAddress = await prisma.vendorAddress.findFirst({
    where: {
      address,
      vendor: {
        ownerAddress,
      },
    },
    include: {
      vendor: {
        include: {
          addresses: {
            orderBy: [{ isPrimary: "desc" }, { network: "asc" }],
          },
        },
      },
    },
  })

  if (!vendorAddress) return null

  const vendor = vendorAddress.vendor

  return {
    id: vendor.id,
    name: vendor.name,
    ownerAddress: vendor.ownerAddress,
    companyName: vendor.companyName,
    email: vendor.email,
    category: vendor.category,
    tags: vendor.tags,
    addresses: vendor.addresses.map((a) => ({
      id: a.id,
      network: a.network,
      address: a.address,
      label: a.label,
      isPrimary: a.isPrimary,
      verifiedAt: a.verifiedAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  }
}
