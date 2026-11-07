import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"
import fs from "fs"
import os from "os"
import path from "path"
import { Wallet, type TypedDataDomain, type TypedDataField } from "ethers"
import { prisma } from "@/lib/prisma"

export class AgentWalletConfigError extends Error {}

export interface AgentWalletRecord {
  agentId: string
  ownerAddress: string
  address: string
  chainType: "EVM"
  encryptedKey: { data: string; iv: string; tag: string } | null
  keyVersion: number
  status: "active" | "revoked"
  label: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentWalletPublic {
  address: string
  chainType: "EVM"
  status: "active" | "revoked"
  label: string | null
  createdAt: string
  updatedAt: string
  canSign: boolean
}

export type AgentWalletSignRequest =
  | { kind: "message"; message: string }
  | {
      kind: "typedData"
      domain: TypedDataDomain
      types: Record<string, TypedDataField[]>
      value: Record<string, unknown>
      primaryType?: string
    }

const TYPED_DATA_ALLOWLIST = new Set([
  "TransferWithAuthorization",
  "ReceiveWithAuthorization",
  "Permit",
])

function resolveSecret(): Buffer {
  const dedicated = process.env.AGENT_WALLET_SECRET
  if (dedicated && /^[0-9a-fA-F]{64}$/.test(dedicated)) {
    return Buffer.from(dedicated, "hex")
  }
  if (process.env.NODE_ENV !== "production") {
    const fallback = process.env.TRADING_KEY_SECRET
    if (fallback && /^[0-9a-fA-F]{64}$/.test(fallback)) {
      return Buffer.from(fallback, "hex")
    }
  }
  throw new AgentWalletConfigError(
    "AGENT_WALLET_SECRET is not configured (64 hex chars). Refusing to store an agent wallet key.",
  )
}

export function hasAgentWalletSecret(): boolean {
  try {
    resolveSecret()
    return true
  } catch {
    return false
  }
}

function encrypt(plaintext: Buffer): { data: string; iv: string; tag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", resolveSecret(), iv)
  const data = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { data: data.toString("hex"), iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex") }
}

function decrypt(blob: { data: string; iv: string; tag: string }): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", resolveSecret(), Buffer.from(blob.iv, "hex"))
  decipher.setAuthTag(Buffer.from(blob.tag, "hex"))
  return Buffer.concat([decipher.update(Buffer.from(blob.data, "hex")), decipher.final()])
}

function walletDir(): string {
  if (process.env.AGENT_WALLET_STATE_DIR) return process.env.AGENT_WALLET_STATE_DIR
  const projectDir = path.join(process.cwd(), ".data", "agent-wallets")
  try {
    fs.mkdirSync(projectDir, { recursive: true })
    fs.accessSync(projectDir, fs.constants.W_OK)
    return projectDir
  } catch {
    return path.join(os.tmpdir(), "protocol-bank-agent-wallets")
  }
}

function filePath(agentId: string): string {
  return path.join(walletDir(), `${agentId}.json`)
}

interface AgentWalletRow {
  agent_id: string
  owner_address: string
  address: string
  chain_type: string
  encrypted_private_key: string | null
  key_iv: string | null
  key_tag: string | null
  key_version: number
  status: string
  label: string | null
  created_at: Date
  updated_at: Date
}

function fromRow(row: AgentWalletRow): AgentWalletRecord {
  const encryptedKey =
    row.encrypted_private_key && row.key_iv && row.key_tag
      ? { data: row.encrypted_private_key, iv: row.key_iv, tag: row.key_tag }
      : null
  return {
    agentId: row.agent_id,
    ownerAddress: row.owner_address,
    address: row.address,
    chainType: "EVM",
    encryptedKey,
    keyVersion: row.key_version,
    status: row.status === "revoked" ? "revoked" : "active",
    label: row.label,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function readFileRecord(agentId: string): AgentWalletRecord | null {
  try {
    return JSON.parse(fs.readFileSync(filePath(agentId), "utf-8")) as AgentWalletRecord
  } catch {
    return null
  }
}

function writeFileRecord(record: AgentWalletRecord): void {
  try {
    fs.mkdirSync(walletDir(), { recursive: true })
    fs.writeFileSync(filePath(record.agentId), JSON.stringify(record, null, 2), "utf-8")
  } catch {
  }
}

async function saveRecord(record: AgentWalletRecord): Promise<void> {
  try {
    await prisma.agentWallet.upsert({
      where: { agent_id: record.agentId },
      create: {
        agent_id: record.agentId,
        owner_address: record.ownerAddress,
        address: record.address,
        chain_type: record.chainType,
        encrypted_private_key: record.encryptedKey?.data ?? null,
        key_iv: record.encryptedKey?.iv ?? null,
        key_tag: record.encryptedKey?.tag ?? null,
        key_version: record.keyVersion,
        status: record.status,
        label: record.label,
      },
      update: {
        owner_address: record.ownerAddress,
        address: record.address,
        encrypted_private_key: record.encryptedKey?.data ?? null,
        key_iv: record.encryptedKey?.iv ?? null,
        key_tag: record.encryptedKey?.tag ?? null,
        key_version: record.keyVersion,
        status: record.status,
        label: record.label,
        updated_at: new Date(),
      },
    })
  } catch {
  }
  writeFileRecord(record)
}

async function loadRecord(agentId: string): Promise<AgentWalletRecord | null> {
  try {
    const row = await prisma.agentWallet.findUnique({ where: { agent_id: agentId } })
    if (row) return fromRow(row as AgentWalletRow)
  } catch {
  }
  return readFileRecord(agentId)
}

async function logActivity(
  agentId: string,
  ownerAddress: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.agentActivity.create({
      data: {
        agent_id: agentId,
        owner_address: ownerAddress,
        action,
        details: JSON.parse(JSON.stringify(details)),
      },
    })
  } catch {
  }
}

export function toPublicWallet(record: AgentWalletRecord | null): AgentWalletPublic | null {
  if (!record) return null
  return {
    address: record.address,
    chainType: record.chainType,
    status: record.status,
    label: record.label,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canSign: record.status === "active" && !!record.encryptedKey,
  }
}

export async function getAgentWallet(agentId: string): Promise<AgentWalletRecord | null> {
  return loadRecord(agentId)
}

export async function createAgentWallet(
  agentId: string,
  ownerAddress: string,
  label?: string | null,
): Promise<AgentWalletRecord> {
  const existing = await loadRecord(agentId)
  if (existing) {
    if (existing.status === "revoked") {
      throw new Error("This agent's wallet was revoked. Rotate it to create a new address.")
    }
    return existing
  }

  const wallet = Wallet.createRandom()
  const now = new Date().toISOString()
  const record: AgentWalletRecord = {
    agentId,
    ownerAddress: ownerAddress.toLowerCase(),
    address: wallet.address,
    chainType: "EVM",
    encryptedKey: encrypt(Buffer.from(wallet.privateKey.slice(2), "hex")),
    keyVersion: 1,
    status: "active",
    label: label ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await saveRecord(record)
  await logActivity(agentId, record.ownerAddress, "wallet_created", {
    address: record.address,
  })
  return record
}

export async function rotateAgentWallet(
  agentId: string,
  ownerAddress: string,
  label?: string | null,
): Promise<AgentWalletRecord> {
  const existing = await loadRecord(agentId)
  if (existing && existing.status === "active") {
    throw new Error("Wallet is active. Revoke it before rotating.")
  }

  const wallet = Wallet.createRandom()
  const now = new Date().toISOString()
  const record: AgentWalletRecord = {
    agentId,
    ownerAddress: ownerAddress.toLowerCase(),
    address: wallet.address,
    chainType: "EVM",
    encryptedKey: encrypt(Buffer.from(wallet.privateKey.slice(2), "hex")),
    keyVersion: (existing?.keyVersion ?? 0) + 1,
    status: "active",
    label: label ?? existing?.label ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await saveRecord(record)
  await logActivity(agentId, record.ownerAddress, "wallet_rotated", {
    address: record.address,
    previousAddress: existing?.address ?? null,
  })
  return record
}

export async function revokeAgentWallet(agentId: string): Promise<void> {
  const existing = await loadRecord(agentId)
  if (!existing) throw new Error("Agent wallet not found")

  const revoked: AgentWalletRecord = {
    ...existing,
    encryptedKey: null,
    status: "revoked",
    updatedAt: new Date().toISOString(),
  }
  await saveRecord(revoked)
  await logActivity(agentId, existing.ownerAddress, "wallet_revoked", {
    address: existing.address,
  })
}

export async function signWithAgentWallet(
  agentId: string,
  request: AgentWalletSignRequest,
): Promise<{ address: string; signature: string }> {
  const record = await loadRecord(agentId)
  if (!record) throw new Error("Agent wallet not found")
  if (record.status !== "active" || !record.encryptedKey) {
    throw new Error("Agent wallet is revoked")
  }

  const wallet = new Wallet(`0x${decrypt(record.encryptedKey).toString("hex")}`)
  let signature: string

  if (request.kind === "message") {
    if (typeof request.message !== "string" || request.message.length === 0) {
      throw new Error("message is required")
    }
    if (request.message.length > 10_000) throw new Error("message is too long")
    signature = await wallet.signMessage(request.message)
  } else {
    const types = { ...request.types }
    delete types.EIP712Domain
    const primaryTypes = Object.keys(types)
    if (primaryTypes.length === 0) throw new Error("typedData types are required")
    const unsupported = primaryTypes.filter((t) => !TYPED_DATA_ALLOWLIST.has(t))
    if (unsupported.length) {
      throw new Error(`Unsupported typed data type: ${unsupported.join(", ")}`)
    }
    signature = await wallet.signTypedData(request.domain, types, request.value)
  }

  await logActivity(agentId, record.ownerAddress, "wallet_signed", {
    kind: request.kind,
    primaryType: request.kind === "typedData" ? request.primaryType ?? null : null,
  })
  return { address: record.address, signature }
}

export function walletKeyFingerprint(): string | null {
  try {
    return createHash("sha256").update(resolveSecret()).digest("hex").slice(0, 12)
  } catch {
    return null
  }
}
