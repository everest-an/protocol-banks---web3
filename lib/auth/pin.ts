import argon2 from "argon2"

// Argon2id parameters chosen for interactive logins
const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 1,
}

export async function hashPin(pin: string): Promise<string> {
  return argon2.hash(pin, ARGON2_OPTIONS)
}

export async function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, pin, ARGON2_OPTIONS)
  } catch {
    return false
  }
}
