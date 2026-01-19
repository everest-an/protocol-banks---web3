/**
 * Embedded Wallet Management
 *
 * Creates HD wallets with Shamir Secret Sharing for secure key management.
 * Private keys are split into 3 shares:
 * - Share A: Device share (stored in IndexedDB)
 * - Share B: Server share (stored in Supabase, encrypted)
 * - Share C: Recovery share (given to user for backup)
 */

import { ethers } from "ethers"
import { splitSecret, combineShares } from "./shamir"
import {
  generateRandomBytes,
  deriveKeyFromPIN,
  encryptAES,
  decryptAES,
  toBase64,
  fromBase64,
  toHex,
  fromHex,
} from "./crypto"

export interface WalletShares {
  address: string
  // Encrypted shares (base64)
  deviceShare: {
    encrypted: string
    iv: string
  }
  serverShare: {
    encrypted: string
    iv: string
  }
  recoveryShare: {
    encrypted: string
    iv: string
  }
  // Key derivation params
  salt: string
  // Encrypted mnemonic for backup
  encryptedMnemonic: {
    ciphertext: string
    iv: string
  }
}

export interface WalletCreationResult {
  address: string
  publicKey: string
  shares: WalletShares
  mnemonic: string // Show once for user to backup
  recoveryCode: string // Show once for user to store
}

/**
 * Create a new embedded wallet with Shamir secret sharing
 *
 * @param pin - User's 6-digit PIN for encryption
 * @returns Wallet creation result with shares and mnemonic
 */
export async function createEmbeddedWallet(pin: string): Promise<WalletCreationResult> {
  // 1. Generate HD wallet
  const wallet = ethers.Wallet.createRandom()
  const privateKeyBytes = fromHex(wallet.privateKey.slice(2)) // Remove 0x prefix
  const mnemonic = wallet.mnemonic?.phrase || ""

  // 2. Generate salt for key derivation
  const salt = generateRandomBytes(32)

  // 3. Derive encryption key from PIN
  const encryptionKey = await deriveKeyFromPIN(pin, salt)

  // 4. Split private key into 3 shares (threshold: 2)
  const shares = splitSecret(privateKeyBytes, 3, 2)

  // 5. Encrypt each share
  const [deviceShare, serverShare, recoveryShare] = await Promise.all([
    encryptAES(shares[0].shares, encryptionKey),
    encryptAES(shares[1].shares, encryptionKey),
    encryptAES(shares[2].shares, encryptionKey),
  ])

  // 6. Encrypt mnemonic for backup
  const mnemonicBytes = new TextEncoder().encode(mnemonic)
  const encryptedMnemonic = await encryptAES(mnemonicBytes, encryptionKey)

  // 7. Generate recovery code (different from shares)
  const recoveryCode = Array.from(generateRandomBytes(6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("-")
    .toUpperCase()

  return {
    address: wallet.address,
    publicKey: wallet.publicKey,
    shares: {
      address: wallet.address,
      deviceShare: {
        encrypted: toBase64(deviceShare.ciphertext),
        iv: toBase64(deviceShare.iv),
      },
      serverShare: {
        encrypted: toBase64(serverShare.ciphertext),
        iv: toBase64(serverShare.iv),
      },
      recoveryShare: {
        encrypted: toBase64(recoveryShare.ciphertext),
        iv: toBase64(recoveryShare.iv),
      },
      salt: toBase64(salt),
      encryptedMnemonic: {
        ciphertext: toBase64(encryptedMnemonic.ciphertext),
        iv: toBase64(encryptedMnemonic.iv),
      },
    },
    mnemonic,
    recoveryCode,
  }
}

/**
 * Reconstruct wallet from shares
 *
 * @param pin - User's PIN for decryption
 * @param salt - Salt used for key derivation (base64)
 * @param share1 - First encrypted share
 * @param share2 - Second encrypted share
 * @param shareIndex1 - Index of first share (0=device, 1=server, 2=recovery)
 * @param shareIndex2 - Index of second share
 * @returns Reconstructed ethers.Wallet
 */
export async function reconstructWallet(
  pin: string,
  salt: string,
  share1: { encrypted: string; iv: string },
  share2: { encrypted: string; iv: string },
  shareIndex1: number,
  shareIndex2: number,
): Promise<ethers.Wallet> {
  // 1. Derive decryption key
  const decryptionKey = await deriveKeyFromPIN(pin, fromBase64(salt))

  // 2. Decrypt shares
  const [decryptedShare1, decryptedShare2] = await Promise.all([
    decryptAES(fromBase64(share1.encrypted), decryptionKey, fromBase64(share1.iv)),
    decryptAES(fromBase64(share2.encrypted), decryptionKey, fromBase64(share2.iv)),
  ])

  // 3. Reconstruct private key using Shamir
  const shares = [
    { x: shareIndex1 + 1, shares: decryptedShare1 },
    { x: shareIndex2 + 1, shares: decryptedShare2 },
  ]
  const privateKeyBytes = combineShares(shares)

  // 4. Create wallet from private key
  const privateKeyHex = "0x" + toHex(privateKeyBytes)
  return new ethers.Wallet(privateKeyHex)
}

/**
 * Sign a transaction using reconstructed wallet
 */
export async function signTransaction(
  pin: string,
  salt: string,
  deviceShare: { encrypted: string; iv: string },
  serverShare: { encrypted: string; iv: string },
  transaction: ethers.TransactionRequest,
): Promise<string> {
  // Reconstruct wallet using device + server shares
  const wallet = await reconstructWallet(
    pin,
    salt,
    deviceShare,
    serverShare,
    0, // device share index
    1, // server share index
  )

  // Sign and return serialized transaction
  return wallet.signTransaction(transaction)
}

/**
 * Sign a message using reconstructed wallet
 */
export async function signMessage(
  pin: string,
  salt: string,
  deviceShare: { encrypted: string; iv: string },
  serverShare: { encrypted: string; iv: string },
  message: string,
): Promise<string> {
  const wallet = await reconstructWallet(pin, salt, deviceShare, serverShare, 0, 1)

  return wallet.signMessage(message)
}

/**
 * Export mnemonic (requires PIN)
 */
export async function exportMnemonic(
  pin: string,
  salt: string,
  encryptedMnemonic: { ciphertext: string; iv: string },
): Promise<string> {
  const decryptionKey = await deriveKeyFromPIN(pin, fromBase64(salt))
  const mnemonicBytes = await decryptAES(
    fromBase64(encryptedMnemonic.ciphertext),
    decryptionKey,
    fromBase64(encryptedMnemonic.iv),
  )
  return new TextDecoder().decode(mnemonicBytes)
}

/**
 * Recover wallet using recovery share + server share
 */
export async function recoverWallet(
  pin: string,
  salt: string,
  serverShare: { encrypted: string; iv: string },
  recoveryShare: { encrypted: string; iv: string },
): Promise<ethers.Wallet> {
  return reconstructWallet(
    pin,
    salt,
    serverShare,
    recoveryShare,
    1, // server share index
    2, // recovery share index
  )
}

/**
 * Generate new device share after recovery
 * (Re-splits the private key and creates a new device share)
 */
export async function regenerateDeviceShare(
  wallet: ethers.Wallet,
  pin: string,
  existingSalt: string,
): Promise<{ encrypted: string; iv: string }> {
  const privateKeyBytes = fromHex(wallet.privateKey.slice(2))
  const encryptionKey = await deriveKeyFromPIN(pin, fromBase64(existingSalt))

  // Create new shares (we only need the device share)
  const shares = splitSecret(privateKeyBytes, 3, 2)
  const encrypted = await encryptAES(shares[0].shares, encryptionKey)

  return {
    encrypted: toBase64(encrypted.ciphertext),
    iv: toBase64(encrypted.iv),
  }
}

/**
 * Validate PIN format
 */
export function validatePIN(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: "PIN must be exactly 6 digits" }
  }

  // Check for common weak PINs
  const weakPINs = ["000000", "111111", "123456", "654321", "123123"]
  if (weakPINs.includes(pin)) {
    return { valid: false, error: "PIN is too weak. Please choose a stronger PIN." }
  }

  // Reject sequential ascending/descending patterns
  const digits = pin.split("").map((d) => Number.parseInt(d, 10))
  const isAscending = digits.every((d, i) => i === 0 || digits[i - 1] + 1 === d)
  const isDescending = digits.every((d, i) => i === 0 || digits[i - 1] - 1 === d)
  if (isAscending || isDescending) {
    return { valid: false, error: "PIN cannot be sequential" }
  }

  // Reject single repeated digit (e.g., 222222)
  if (new Set(digits).size === 1) {
    return { valid: false, error: "PIN is too weak. Please choose a stronger PIN." }
  }

  return { valid: true }
}

/**
 * Get wallet address from shares without reconstructing private key
 * (Uses stored address, no decryption needed)
 */
export function getWalletAddress(shares: WalletShares): string {
  return shares.address
}
