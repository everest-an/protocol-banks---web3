import { generateRandomBytes } from "@/lib/auth/crypto"

/**
 * Generate a human-readable recovery code (Share C).
 *
 * Format: XXXX-XXXX-XXXX-XXXX
 *
 * This code is a recovery factor for the Shamir split, so it must come from a
 * CSPRNG. Math.random() is predictable and must never be used for key material.
 */
export function generateRecoveryCode(): string {
  const segments: string[] = []
  for (let i = 0; i < 4; i++) {
    const bytes = generateRandomBytes(4)
    const value =
      ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
    const segment = (value % 36 ** 4)
      .toString(36)
      .toUpperCase()
      .padStart(4, "0")
    segments.push(segment)
  }
  return segments.join("-")
}
