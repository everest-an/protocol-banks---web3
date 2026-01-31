/**
 * Admin Configuration
 * 
 * Defines admin wallet addresses and permission levels
 */

// Admin wallet addresses (lowercase for comparison)
export const ADMIN_WALLETS: string[] = [
  // Add your admin wallet addresses here
  // Example: "0x742d35cc6634c0532925a3b844bc454e4438f44e"
]

// Check if a wallet address is an admin
export function isAdminAddress(address: string | undefined | null): boolean {
  if (!address) return false
  
  // In development, allow any connected wallet to be admin
  if (process.env.NODE_ENV === 'development' || process.env.ALLOW_DEMO_MODE === 'true') {
    return true
  }
  
  const normalizedAddress = address.toLowerCase()
  return ADMIN_WALLETS.some(admin => admin.toLowerCase() === normalizedAddress)
}

// Permission levels
export type AdminRole = 'super_admin' | 'admin' | 'viewer'

export interface AdminPermissions {
  canManageFees: boolean
  canManageContracts: boolean
  canViewMonitoring: boolean
  canManageDomains: boolean
  canViewAuditLogs: boolean
}

// Get permissions for a role
export function getAdminPermissions(role: AdminRole): AdminPermissions {
  switch (role) {
    case 'super_admin':
      return {
        canManageFees: true,
        canManageContracts: true,
        canViewMonitoring: true,
        canManageDomains: true,
        canViewAuditLogs: true,
      }
    case 'admin':
      return {
        canManageFees: true,
        canManageContracts: false,
        canViewMonitoring: true,
        canManageDomains: true,
        canViewAuditLogs: true,
      }
    case 'viewer':
      return {
        canManageFees: false,
        canManageContracts: false,
        canViewMonitoring: true,
        canManageDomains: false,
        canViewAuditLogs: true,
      }
    default:
      return {
        canManageFees: false,
        canManageContracts: false,
        canViewMonitoring: false,
        canManageDomains: false,
        canViewAuditLogs: false,
      }
  }
}
