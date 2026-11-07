import fs from "fs"
import os from "os"
import path from "path"
import { prisma } from "@/lib/prisma"

export type CardProviderId = "RAIN" | "YATIVO"

export interface CardProviderAccountRecord {
  ownerAddress: string
  provider: CardProviderId
  providerUserId: string
  status: string
  rawStatus: string | null
  createdAt: string
  updatedAt: string
}

export interface CardProviderAccountPublic {
  provider: CardProviderId
  status: string
  createdAt: string
  updatedAt: string
}

function accountDir(): string {
  if (process.env.CARD_PROVIDER_STATE_DIR) return process.env.CARD_PROVIDER_STATE_DIR
  const projectDir = path.join(process.cwd(), ".data", "card-provider-accounts")
  try {
    fs.mkdirSync(projectDir, { recursive: true })
    fs.accessSync(projectDir, fs.constants.W_OK)
    return projectDir
  } catch {
    return path.join(os.tmpdir(), "protocol-bank-card-provider-accounts")
  }
}

function filePath(ownerAddress: string): string {
  return path.join(accountDir(), `${ownerAddress.toLowerCase()}.json`)
}

interface CardProviderAccountRow {
  owner_address: string
  provider: string
  provider_user_id: string
  status: string
  raw_status: string | null
  created_at: Date
  updated_at: Date
}

function fromRow(row: CardProviderAccountRow): CardProviderAccountRecord {
  return {
    ownerAddress: row.owner_address,
    provider: row.provider === "YATIVO" ? "YATIVO" : "RAIN",
    providerUserId: row.provider_user_id,
    status: row.status,
    rawStatus: row.raw_status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function readFile(ownerAddress: string): CardProviderAccountRecord | null {
  try {
    return JSON.parse(fs.readFileSync(filePath(ownerAddress), "utf-8")) as CardProviderAccountRecord
  } catch {
    return null
  }
}

function writeFile(record: CardProviderAccountRecord): void {
  try {
    fs.mkdirSync(accountDir(), { recursive: true })
    fs.writeFileSync(filePath(record.ownerAddress), JSON.stringify(record, null, 2), "utf-8")
  } catch {
  }
}

export async function getCardProviderAccount(
  ownerAddress: string,
): Promise<CardProviderAccountRecord | null> {
  const owner = ownerAddress.toLowerCase()
  try {
    const row = await prisma.cardProviderAccount.findUnique({ where: { owner_address: owner } })
    if (row) return fromRow(row as CardProviderAccountRow)
  } catch {
  }
  return readFile(owner)
}

export async function saveCardProviderAccount(
  record: CardProviderAccountRecord,
): Promise<CardProviderAccountRecord> {
  const normalized: CardProviderAccountRecord = {
    ...record,
    ownerAddress: record.ownerAddress.toLowerCase(),
    updatedAt: new Date().toISOString(),
  }
  try {
    await prisma.cardProviderAccount.upsert({
      where: { owner_address: normalized.ownerAddress },
      create: {
        owner_address: normalized.ownerAddress,
        provider: normalized.provider,
        provider_user_id: normalized.providerUserId,
        status: normalized.status,
        raw_status: normalized.rawStatus,
      },
      update: {
        provider: normalized.provider,
        provider_user_id: normalized.providerUserId,
        status: normalized.status,
        raw_status: normalized.rawStatus,
        updated_at: new Date(),
      },
    })
  } catch {
  }
  writeFile(normalized)
  return normalized
}

export function toPublicCardProviderAccount(
  record: CardProviderAccountRecord | null,
): CardProviderAccountPublic | null {
  if (!record) return null
  return {
    provider: record.provider,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
