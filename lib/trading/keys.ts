/**
 * Agent wallet key management — LIVE mode.
 *
 * The platform generates one secp256k1 keypair per user wallet. The key
 * becomes the Hyperliquid "agent wallet" the user approves (trading-only,
 * no withdrawal rights). The private key is AES-256-GCM encrypted at rest
 * with a server-side secret and stored per user — never shared, never
 * derivable from another user's key.
 *
 * Production note: store these in the TradingAccount DB table (see
 * prisma/schema.prisma) — the file storage below is the local/dev fallback
 * and keeps the whole flow testable without a database.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"
import fs from "fs"
import path from "path"
import os from "os"
import { Wallet } from "ethers"

function resolveLiveDir(): string {
  if (process.env.TRADING_STATE_DIR) return path.join(process.env.TRADING_STATE_DIR, "live")
  const projectDir = path.join(process.cwd(), ".data", "trading", "live")
  try {
    fs.mkdirSync(projectDir, { recursive: true })
    fs.accessSync(projectDir, fs.constants.W_OK)
    return projectDir
  } catch {
    // Serverless (read-only project dir): /tmp fallback. NOTE: live agent
    // keys must be stored in the TradingAccount DB table in production —
    // the file store is the local/dev fallback only.
    return path.join(os.tmpdir(), "protocol-bank-trading", "live")
  }
}

const LIVE_DIR = resolveLiveDir()

export interface EncryptedBlob {
  iv: string // hex
  tag: string // hex (auth tag)
  data: string // hex (ciphertext)
}

export interface AgentKeyRecord {
  walletAddress: string // owner (lowercase)
  agentAddress: string // checksummed
  encryptedKey: EncryptedBlob
  name: string
  approved: boolean
  approvedAt: string | null
  createdAt: string
}

/** Derive a 32-byte secret from the env var (hex or passphrase). */
function deriveSecret(): Buffer {
  const raw = process.env.TRADING_KEY_SECRET
  if (!raw) {
    // Dev fallback: deterministic placeholder. NEVER acceptable in production —
    // the API refuses live mode unless TRADING_KEY_SECRET is set to 64 hex chars.
    return createHash("sha256").update("dev-insecure-key-do-not-use").digest()
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex")
  return createHash("sha256").update(raw).digest()
}

export function hasKeySecret(): boolean {
  const raw = process.env.TRADING_KEY_SECRET
  return !!raw && /^[0-9a-fA-F]{64}$/.test(raw)
}

function encrypt(plaintext: Buffer): EncryptedBlob {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveSecret(), iv)
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") }
}

function decrypt(blob: EncryptedBlob): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", deriveSecret(), Buffer.from(blob.iv, "hex"))
  decipher.setAuthTag(Buffer.from(blob.tag, "hex"))
  return Buffer.concat([decipher.update(Buffer.from(blob.data, "hex")), decipher.final()])
}

function filePath(walletAddress: string): string {
  return path.join(LIVE_DIR, `${walletAddress.toLowerCase()}.json`)
}

/** Generate a new agent keypair for a user wallet. */
export function generateAgentKey(walletAddress: string, name?: string): AgentKeyRecord {
  const wallet = Wallet.createRandom()
  const record: AgentKeyRecord = {
    walletAddress: walletAddress.toLowerCase(),
    agentAddress: wallet.address, // checksummed
    encryptedKey: encrypt(Buffer.from(wallet.privateKey.slice(2), "hex")),
    name: name ?? "Protocol Bank AI",
    approved: false,
    approvedAt: null,
    createdAt: new Date().toISOString(),
  }
  fs.mkdirSync(LIVE_DIR, { recursive: true })
  fs.writeFileSync(filePath(walletAddress), JSON.stringify(record, null, 2), "utf-8")
  return record
}

/** Load a user's agent key record (no decryption). */
export function loadAgentKeyRecord(walletAddress: string): AgentKeyRecord | null {
  try {
    const raw = fs.readFileSync(filePath(walletAddress), "utf-8")
    return JSON.parse(raw) as AgentKeyRecord
  } catch {
    return null
  }
}

/** Decrypt and return the agent signing wallet. */
export function getAgentWallet(walletAddress: string): Wallet | null {
  const record = loadAgentKeyRecord(walletAddress)
  if (!record) return null
  try {
    const priv = decrypt(record.encryptedKey)
    return new Wallet(`0x${priv.toString("hex")}`)
  } catch {
    return null
  }
}

export function markApproved(walletAddress: string): AgentKeyRecord | null {
  const record = loadAgentKeyRecord(walletAddress)
  if (!record) return null
  record.approved = true
  record.approvedAt = new Date().toISOString()
  fs.writeFileSync(filePath(walletAddress), JSON.stringify(record, null, 2), "utf-8")
  return record
}

export function revokeAgentKey(walletAddress: string): void {
  const record = loadAgentKeyRecord(walletAddress)
  if (!record) return
  // The on-chain revocation is a user-side action (Hyperliquid UI / API).
  // Locally we mark the record as unusable and delete the key material.
  fs.rmSync(filePath(walletAddress), { force: true })
}
