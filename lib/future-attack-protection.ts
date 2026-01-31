/**
 * Future Attack Protection - Clipboard Hijacking Prevention
 * 
 * This module provides utilities to protect users from clipboard hijacking attacks
 * where malware replaces copied cryptocurrency addresses with attacker's addresses.
 */

export interface ClipboardSecurityResult {
  isSecure: boolean
  originalAddress?: string
  currentClipboard?: string
  modificationDetails?: string
}

/**
 * Generate visual address chunks for easier verification
 * Splits address into groups of 4 characters for easier visual comparison
 */
export function generateVisualAddressChunks(address: string): string {
  if (!address) return ""
  
  // Remove 0x prefix for chunking, then add it back
  const hasPrefix = address.toLowerCase().startsWith("0x")
  const cleanAddress = hasPrefix ? address.slice(2) : address
  
  // Split into chunks of 4 characters
  const chunks: string[] = []
  for (let i = 0; i < cleanAddress.length; i += 4) {
    chunks.push(cleanAddress.slice(i, i + 4))
  }
  
  const chunkedAddress = chunks.join(" ")
  return hasPrefix ? `0x ${chunkedAddress}` : chunkedAddress
}

/**
 * Generate a simple checksum for visual verification
 * Creates a short string from first 4 + last 4 characters
 */
export function generateAddressChecksum(address: string): string {
  if (!address || address.length < 10) return "Invalid"
  
  const cleanAddress = address.toLowerCase().startsWith("0x") 
    ? address.slice(2) 
    : address
  
  const first4 = cleanAddress.slice(0, 4).toUpperCase()
  const last4 = cleanAddress.slice(-4).toUpperCase()
  
  return `${first4}...${last4}`
}

/**
 * Compare two addresses to check if they match
 */
export function compareAddresses(addr1: string, addr2: string): boolean {
  if (!addr1 || !addr2) return false
  return addr1.toLowerCase().trim() === addr2.toLowerCase().trim()
}

/**
 * Detect potential address poisoning
 * Checks if address starts and ends similarly but differs in the middle
 */
export function detectAddressPoisoning(original: string, current: string): boolean {
  if (!original || !current) return false
  if (original.length !== current.length) return false
  
  const o = original.toLowerCase()
  const c = current.toLowerCase()
  
  // Check if first 6 and last 4 characters match but middle differs
  // This is a common poisoning pattern
  const sameStart = o.slice(0, 6) === c.slice(0, 6)
  const sameEnd = o.slice(-4) === c.slice(-4)
  const differentMiddle = o !== c
  
  return sameStart && sameEnd && differentMiddle
}

/**
 * ClipboardMonitor class for tracking and verifying clipboard content
 */
export class ClipboardMonitor {
  private lastCopiedAddress: string | null = null
  private lastCopiedTimestamp: number = 0
  private readonly maxAgeMs: number = 5 * 60 * 1000 // 5 minutes

  /**
   * Record when an address is copied
   */
  async recordCopy(address: string): Promise<void> {
    this.lastCopiedAddress = address
    this.lastCopiedTimestamp = Date.now()
  }

  /**
   * Verify the current clipboard content matches what was copied
   */
  async verifyClipboard(): Promise<ClipboardSecurityResult> {
    try {
      // Check if we have a recorded copy
      if (!this.lastCopiedAddress) {
        return {
          isSecure: false,
          modificationDetails: "No address was recorded. Please copy the address first.",
        }
      }

      // Check if the recorded copy has expired
      const age = Date.now() - this.lastCopiedTimestamp
      if (age > this.maxAgeMs) {
        return {
          isSecure: false,
          originalAddress: this.lastCopiedAddress,
          modificationDetails: "Recorded address has expired. Please copy again.",
        }
      }

      // Read current clipboard
      const currentClipboard = await navigator.clipboard.readText()

      // Compare addresses
      const isMatch = compareAddresses(this.lastCopiedAddress, currentClipboard)

      if (isMatch) {
        return {
          isSecure: true,
          originalAddress: this.lastCopiedAddress,
          currentClipboard: currentClipboard,
        }
      }

      // Check for poisoning attack
      const isPoisoning = detectAddressPoisoning(this.lastCopiedAddress, currentClipboard)

      return {
        isSecure: false,
        originalAddress: this.lastCopiedAddress,
        currentClipboard: currentClipboard,
        modificationDetails: isPoisoning
          ? "DANGER: Address poisoning detected! The address has been replaced with a similar-looking fake."
          : "WARNING: Clipboard content has been modified. The address no longer matches.",
      }
    } catch (error) {
      // Clipboard API might fail due to permissions
      return {
        isSecure: false,
        modificationDetails: "Could not read clipboard. Please check browser permissions.",
      }
    }
  }

  /**
   * Get the last copied address
   */
  getLastCopiedAddress(): string | null {
    return this.lastCopiedAddress
  }

  /**
   * Clear the recorded address
   */
  clear(): void {
    this.lastCopiedAddress = null
    this.lastCopiedTimestamp = 0
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    this.clear()
  }
}

/**
 * Utility to create a secure copy-paste workflow
 */
export async function secureCopyAddress(address: string): Promise<{
  success: boolean
  checksum: string
  message: string
}> {
  try {
    await navigator.clipboard.writeText(address)
    const checksum = generateAddressChecksum(address)
    
    return {
      success: true,
      checksum,
      message: `Address copied. Verify checksum: ${checksum}`,
    }
  } catch (error) {
    return {
      success: false,
      checksum: "",
      message: "Failed to copy address to clipboard",
    }
  }
}
