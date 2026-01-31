/**
 * Hash an API key using SHA-256
 */
export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Verify an API key against a hash
 */
export async function verifyKey(key: string, hash: string): Promise<boolean> {
  const keyHash = await hashKey(key)
  return keyHash === hash
}
